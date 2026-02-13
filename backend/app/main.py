from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, cars, bookings, profile

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(cars.router)
app.include_router(bookings.router)
app.include_router(profile.router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "carhop-api"}
