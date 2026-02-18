"""add stripe ledger fields and webhook events

Revision ID: b7f2c41d9a33
Revises: a8b1c3d4e5f6
Create Date: 2026-02-18 23:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7f2c41d9a33"
down_revision: Union[str, Sequence[str], None] = "a8b1c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("stripe_payment_intent_id", sa.String(), nullable=True))
    op.add_column("payments", sa.Column("stripe_charge_id", sa.String(), nullable=True))
    op.add_column("payments", sa.Column("stripe_transfer_id", sa.String(), nullable=True))
    op.add_column("payments", sa.Column("stripe_refund_id", sa.String(), nullable=True))

    op.create_table(
        "stripe_webhook_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stripe_webhook_events_event_id", "stripe_webhook_events", ["event_id"], unique=True)
    op.create_index("ix_stripe_webhook_events_event_type", "stripe_webhook_events", ["event_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_stripe_webhook_events_event_type", table_name="stripe_webhook_events")
    op.drop_index("ix_stripe_webhook_events_event_id", table_name="stripe_webhook_events")
    op.drop_table("stripe_webhook_events")

    op.drop_column("payments", "stripe_refund_id")
    op.drop_column("payments", "stripe_transfer_id")
    op.drop_column("payments", "stripe_charge_id")
    op.drop_column("payments", "stripe_payment_intent_id")
