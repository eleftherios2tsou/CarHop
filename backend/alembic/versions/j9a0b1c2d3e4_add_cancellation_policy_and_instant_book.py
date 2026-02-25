"""add cancellation policy and instant book

Revision ID: j9a0b1c2d3e4
Revises: i8f9a0b1c2d3
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

revision = "j9a0b1c2d3e4"
down_revision = "i8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Cars: cancellation policy + instant book flag
    op.add_column(
        "cars",
        sa.Column("cancellation_policy", sa.String(), nullable=False, server_default="FLEXIBLE"),
    )
    op.add_column(
        "cars",
        sa.Column("instant_book_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Payments: refund tracking for cancellation policy
    op.add_column("payments", sa.Column("refund_amount_pence", sa.Integer(), nullable=True))
    op.add_column("payments", sa.Column("cancellation_policy_applied", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "cancellation_policy_applied")
    op.drop_column("payments", "refund_amount_pence")
    op.drop_column("cars", "instant_book_enabled")
    op.drop_column("cars", "cancellation_policy")
