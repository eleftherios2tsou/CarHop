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
    stripe_payment_intent_id: str | None = None
    stripe_charge_id: str | None = None
    stripe_transfer_id: str | None = None
    stripe_refund_id: str | None = None
    created_at: datetime
    paid_at: datetime | None = None
    released_at: datetime | None = None
    refunded_at: datetime | None = None
    deposit_amount_pence: int = 25000
    deposit_status: str = "HELD"
    deposit_released_at: datetime | None = None
    refund_amount_pence: int | None = None
    cancellation_policy_applied: str | None = None

    class Config:
        from_attributes = True


class PaymentCheckoutOut(BaseModel):
    checkout_url: str | None = None
    checkout_session_id: str | None = None
    payment: PaymentOut
