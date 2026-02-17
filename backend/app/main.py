#backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, cars, bookings, profile

app = FastAPI()

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(cars.router)
app.include_router(bookings.router)
app.include_router(profile.router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "carhop-api", "env": settings.environment}
