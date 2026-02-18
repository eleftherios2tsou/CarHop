"""create payments table

Revision ID: f4a7d2c6b1e0
Revises: c3d8e21aa7f0
Create Date: 2026-02-18 20:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4a7d2c6b1e0"
down_revision: Union[str, Sequence[str], None] = "c3d8e21aa7f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("booking_id", sa.Integer(), nullable=False),
        sa.Column("renter_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False, server_default=sa.text("'GBP'")),
        sa.Column("amount_total", sa.Integer(), nullable=False),
        sa.Column("platform_fee", sa.Integer(), nullable=False),
        sa.Column("payout_amount", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default=sa.text("'HELD_IN_ESCROW'")),
        sa.Column("provider", sa.String(), nullable=False, server_default=sa.text("'SIMULATED'")),
        sa.Column("provider_ref", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["renter_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payments_booking_id", "payments", ["booking_id"], unique=True)
    op.create_index("ix_payments_owner_id", "payments", ["owner_id"], unique=False)
    op.create_index("ix_payments_renter_id", "payments", ["renter_id"], unique=False)
    op.create_index("ix_payments_status", "payments", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_payments_status", table_name="payments")
    op.drop_index("ix_payments_renter_id", table_name="payments")
    op.drop_index("ix_payments_owner_id", table_name="payments")
    op.drop_index("ix_payments_booking_id", table_name="payments")
    op.drop_table("payments")
