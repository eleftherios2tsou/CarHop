#backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

engine = create_engine(settings.database_url, echo=settings.sql_echo)

SessionLocal = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass
