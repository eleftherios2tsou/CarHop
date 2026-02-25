"""add deposit fields to payments

Revision ID: f5c6d7e8a9b0
Revises: e4b3a2c1d0f9
Create Date: 2026-02-24 11:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5c6d7e8a9b0"
down_revision: Union[str, Sequence[str], None] = "e4b3a2c1d0f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column("deposit_amount_pence", sa.Integer(), nullable=False, server_default="25000"),
    )
    op.add_column(
        "payments",
        sa.Column("deposit_status", sa.String(), nullable=False, server_default="HELD"),
    )
    op.add_column(
        "payments",
        sa.Column("deposit_released_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payments", "deposit_released_at")
    op.drop_column("payments", "deposit_status")
    op.drop_column("payments", "deposit_amount_pence")
