from fastapi import FastAPI
from app.database import engine, Base

# Import models so SQLAlchemy knows about them
from app.models import user, ride  # noqa: F401

app = FastAPI(title="CarHop API", version="0.2.1")

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/health")
def health():
    return {"status": "ok", "service": "carhop-api"}
