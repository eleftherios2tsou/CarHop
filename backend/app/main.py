from fastapi import FastAPI
from app.routers import auth, cars, bookings, profile

app = FastAPI()

app.include_router(auth.router)
app.include_router(cars.router)
app.include_router(bookings.router)
app.include_router(profile.router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "carhop-api"}
