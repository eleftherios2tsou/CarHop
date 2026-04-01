# backend/app/routers/admin.py
# admin-only endpoints for managing users, escrow payments, and licence approvals
# all routes here are protected by _require_admin which checks the user's role
from __future__ import annotations

import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.deps import csrf_protect, get_current_verified_user, get_db
from app.models.license import DriverLicense
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


# response schema for a single user in the admin user list
class UserAdminOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    email_verified: bool
    created_at: datetime
    license_verified: bool  # we join this from the driver_licenses table separately

    model_config = {"from_attributes": True}


# paginated wrapper for the user list endpoint
class PaginatedAdminUsers(BaseModel):
    items: list[UserAdminOut]
    total: int
    page: int
    page_size: int
    pages: int


def _require_admin(current_user: User = Depends(get_current_verified_user)) -> User:
    # reusable guard — attach this as a dependency on any admin-only route
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")
    return current_user


@router.get("/users", response_model=PaginatedAdminUsers)
def list_users(
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    # clamp page and page_size to sane values so bad query params don't cause issues
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    q = db.query(User)
    if search:
        # search across both email and name using a case-insensitive LIKE
        term = f"%{search}%"
        q = q.filter(
            (User.email.ilike(term)) | (User.full_name.ilike(term))
        )

    total = q.count()
    users = q.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    # batch-load all licence records for the current page of users in one query
    # this avoids N+1 queries when building the response
    user_ids = [u.id for u in users]
    license_map: dict[int, bool] = {}
    if user_ids:
        lic_rows = (
            db.query(DriverLicense.user_id, DriverLicense.is_verified)
            .filter(DriverLicense.user_id.in_(user_ids))
            .all()
        )
        license_map = {r[0]: bool(r[1]) for r in lic_rows}

    # build the response objects, defaulting license_verified to False if no record exists
    items = [
        UserAdminOut(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active,
            email_verified=u.email_verified,
            created_at=u.created_at,
            license_verified=license_map.get(u.id, False),
        )
        for u in users
    ]

    return PaginatedAdminUsers(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),  # always at least 1 page even if empty
    )


@router.post("/users/{user_id}/deactivate", dependencies=[Depends(csrf_protect)])
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(_require_admin),
):
    # prevent admins from accidentally deactivating their own account and locking themselves out
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    return {"message": f"User #{user_id} deactivated"}


@router.post("/users/{user_id}/activate", dependencies=[Depends(csrf_protect)])
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    return {"message": f"User #{user_id} activated"}


@router.post("/payments/{booking_id}/release", dependencies=[Depends(csrf_protect)])
def release_escrow(
    booking_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    # imports are inside the function to avoid circular import issues at module load time
    from app.models.booking import BookingRequest
    from app.models.car import CarListing
    from app.models.payment import Payment
    from app.email import notify_escrow_released

    payment = db.query(Payment).filter_by(booking_id=booking_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="No payment found for this booking")
    # can only release funds that are actually being held in escrow
    if payment.status != "HELD_IN_ESCROW":
        raise HTTPException(status_code=400, detail=f"Cannot release: payment status is {payment.status}")

    # mark both the payment and the deposit as released with a timestamp
    payment.status = "RELEASED"
    payment.released_at = datetime.now(timezone.utc)
    payment.deposit_status = "RELEASED"
    payment.deposit_released_at = datetime.now(timezone.utc)
    db.commit()

    # email the owner to let them know the money is on its way to their Stripe account
    booking = db.get(BookingRequest, booking_id)
    if booking:
        car = db.get(CarListing, booking.car_id)
        owner = db.get(User, payment.owner_id)
        if car and owner:
            notify_escrow_released(
                owner_email=owner.email,
                owner_name=owner.full_name,
                car=f"{car.make} {car.model} ({car.year})",
                amount=payment.payout_amount,
                currency=payment.currency,
            )

    return {"message": f"Escrow released for booking #{booking_id}"}


@router.post("/payments/{booking_id}/forfeit", dependencies=[Depends(csrf_protect)])
def forfeit_escrow(
    booking_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    # forfeiting means the owner loses their payout and the money goes back to the renter
    # this is used when a dispute is resolved in the renter's favour
    from app.models.payment import Payment

    payment = db.query(Payment).filter_by(booking_id=booking_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="No payment found for this booking")
    if payment.status != "HELD_IN_ESCROW":
        raise HTTPException(status_code=400, detail=f"Cannot forfeit: payment status is {payment.status}")

    payment.status = "FORFEITED"
    payment.refunded_at = datetime.now(timezone.utc)
    payment.deposit_status = "RELEASED"
    payment.deposit_released_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": f"Escrow forfeited for booking #{booking_id} — funds returned to renter"}
