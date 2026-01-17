from fastapi import FastAPI
from app.database import engine, Base
from app.routers.request import router as requests_router
from app.models import user, ride  # noqa: F401
from app.routers.rides import router as rides_router
from app.routers.auth import router as auth_router

app = FastAPI(title="CarHop API", version="0.4.0")

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

app.include_router(auth_router)
app.include_router(rides_router)
app.include_router(requests_router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "carhop-api"}
