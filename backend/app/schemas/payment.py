from datetime import datetime

from pydantic import BaseModel


class PaymentOut(BaseModel):
    id: int
    booking_id: int
    renter_id: int
    owner_id: int
    currency: str
    amount_total: int
    platform_fee: int
    payout_amount: int
    status: str
    provider: str
    provider_ref: str | None = None
    created_at: datetime
    paid_at: datetime | None = None
    released_at: datetime | None = None
    refunded_at: datetime | None = None

    class Config:
        from_attributes = True


class PaymentCheckoutOut(BaseModel):
    checkout_url: str | None = None
    checkout_session_id: str | None = None
    payment: PaymentOut
