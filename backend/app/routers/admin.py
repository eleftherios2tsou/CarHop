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


@router.get("/stats")
def platform_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    # returns a snapshot of key platform metrics for the admin overview dashboard
    from app.models.booking import BookingRequest
    from app.models.car import CarListing
    from app.models.payment import Payment
    from sqlalchemy import func

    # user counts
    total_users    = db.query(func.count(User.id)).scalar() or 0
    active_users   = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0   # noqa: E712
    verified_users = db.query(func.count(User.id)).filter(User.email_verified == True).scalar() or 0  # noqa: E712
    admin_users    = db.query(func.count(User.id)).filter(User.role == "ADMIN").scalar() or 0

    # car counts
    total_cars     = db.query(func.count(CarListing.id)).scalar() or 0
    available_cars = db.query(func.count(CarListing.id)).filter(CarListing.status == "AVAILABLE").scalar() or 0

    # booking counts per status
    total_bookings     = db.query(func.count(BookingRequest.id)).scalar() or 0
    pending_bookings   = db.query(func.count(BookingRequest.id)).filter(BookingRequest.status == "PENDING").scalar() or 0
    approved_bookings  = db.query(func.count(BookingRequest.id)).filter(BookingRequest.status == "APPROVED").scalar() or 0
    completed_bookings = db.query(func.count(BookingRequest.id)).filter(BookingRequest.status == "COMPLETED").scalar() or 0
    cancelled_bookings = db.query(func.count(BookingRequest.id)).filter(BookingRequest.status == "CANCELLED").scalar() or 0

    # revenue totals in pence
    total_revenue = int(db.query(func.sum(Payment.amount_total)).filter(
        Payment.status.in_(["HELD_IN_ESCROW", "RELEASED"])
    ).scalar() or 0)
    in_escrow_revenue = int(db.query(func.sum(Payment.amount_total)).filter(
        Payment.status == "HELD_IN_ESCROW"
    ).scalar() or 0)
    released_revenue = int(db.query(func.sum(Payment.amount_total)).filter(
        Payment.status == "RELEASED"
    ).scalar() or 0)

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "email_verified": verified_users,
            "admins": admin_users,
        },
        "cars": {
            "total": total_cars,
            "available": available_cars,
        },
        "bookings": {
            "total": total_bookings,
            "pending": pending_bookings,
            "approved": approved_bookings,
            "completed": completed_bookings,
            "cancelled": cancelled_bookings,
        },
        "revenue": {
            "total_pence": total_revenue,
            "in_escrow_pence": in_escrow_revenue,
            "released_pence": released_revenue,
        },
    }


@router.get("/bookings")
def list_bookings(
    page: int = 1,
    page_size: int = 15,
    status: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    # returns a paginated list of all bookings with car + renter info joined in
    from app.models.booking import BookingRequest
    from app.models.car import CarListing
    from app.models.payment import Payment

    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    q = db.query(BookingRequest)
    if status:
        q = q.filter(BookingRequest.status == status.upper())

    total = q.count()
    bookings = q.order_by(BookingRequest.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    if not bookings:
        return {
            "items": [],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": max(1, math.ceil(total / page_size)),
        }

    booking_ids = [b.id for b in bookings]
    car_ids     = list({b.car_id for b in bookings})
    renter_ids  = list({b.renter_id for b in bookings})

    # batch-load all related records to avoid N+1 queries
    cars     = {c.id: c for c in db.query(CarListing).filter(CarListing.id.in_(car_ids)).all()}
    renters  = {u.id: u for u in db.query(User).filter(User.id.in_(renter_ids)).all()}
    payments = {p.booking_id: p for p in db.query(Payment).filter(Payment.booking_id.in_(booking_ids)).all()}

    items = []
    for b in bookings:
        car     = cars.get(b.car_id)
        renter  = renters.get(b.renter_id)
        payment = payments.get(b.id)
        items.append({
            "id":             b.id,
            "status":         b.status,
            "start_date":     str(b.start_date),
            "end_date":       str(b.end_date),
            "car_id":         b.car_id,
            "car_name":       f"{car.make} {car.model} ({car.year})" if car else f"Car #{b.car_id}",
            "owner_id":       car.owner_id if car else None,
            "renter_id":      b.renter_id,
            "renter_name":    renter.full_name if renter else f"User #{b.renter_id}",
            "renter_email":   renter.email if renter else "",
            "amount_pence":   payment.amount_total if payment else None,
            "payment_status": payment.status if payment else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }
