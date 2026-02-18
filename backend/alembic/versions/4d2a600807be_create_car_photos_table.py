"""create car_photos table

Revision ID: 4d2a600807be
Revises: dc2d846db9f9
Create Date: 2026-02-17 17:44:22.473014

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4d2a600807be"
down_revision: Union[str, Sequence[str], None] = "dc2d846db9f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "car_photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("car_id", sa.Integer(), sa.ForeignKey("cars.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_car_photos_car_id", "car_photos", ["car_id"])


def downgrade() -> None:
    op.drop_index("ix_car_photos_car_id", table_name="car_photos")
    op.drop_table("car_photos")
