from fastapi import FastAPI
from app.routers import auth, cars, bookings

app = FastAPI(title="CarHop API", version="0.4.0")


app.include_router(auth.router)
app.include_router(cars.router)
app.include_router(bookings.router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "carhop-api"}
