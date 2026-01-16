from fastapi import FastAPI
from app.database import engine, Base

from app.models import user, ride  # noqa: F401
from app.routers.rides import router as rides_router

app = FastAPI(title="CarHop API", version="0.3.0")

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

app.include_router(rides_router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "carhop-api"}
