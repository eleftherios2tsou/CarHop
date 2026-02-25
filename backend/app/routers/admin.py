"""Admin-only user management endpoints."""
from __future__ import annotations

import math
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.deps import csrf_protect, get_current_verified_user, get_db
from app.models.license import DriverLicense
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


class UserAdminOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    email_verified: bool
    created_at: datetime
    license_verified: bool

    model_config = {"from_attributes": True}


class PaginatedAdminUsers(BaseModel):
    items: list[UserAdminOut]
    total: int
    page: int
    page_size: int
    pages: int


def _require_admin(current_user: User = Depends(get_current_verified_user)) -> User:
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
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    q = db.query(User)
    if search:
        term = f"%{search}%"
        q = q.filter(
            (User.email.ilike(term)) | (User.full_name.ilike(term))
        )

    total = q.count()
    users = q.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    # Batch-load license records
    user_ids = [u.id for u in users]
    license_map: dict[int, bool] = {}
    if user_ids:
        lic_rows = (
            db.query(DriverLicense.user_id, DriverLicense.is_verified)
            .filter(DriverLicense.user_id.in_(user_ids))
            .all()
        )
        license_map = {r[0]: bool(r[1]) for r in lic_rows}

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
        pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/users/{user_id}/deactivate", dependencies=[Depends(csrf_protect)])
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(_require_admin),
):
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
