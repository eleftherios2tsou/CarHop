from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.jwt import SECRET_KEY, ALGORITHM

security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = creds.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.get(User, int(sub))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid user")

    return user


def get_current_verified_user(
    user: User = Depends(get_current_user),
) -> User:
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")
    return user
