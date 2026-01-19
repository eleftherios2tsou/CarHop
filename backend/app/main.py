from fastapi import FastAPI
from app.routers import auth, cars, bookings, profile
from app.database import Base, engine
import app.models
app = FastAPI()

app.include_router(auth.router)
app.include_router(cars.router)
app.include_router(bookings.router)
app.include_router(profile.router)

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/health")
def health():
    return {"status": "ok", "service": "carhop-api"}
