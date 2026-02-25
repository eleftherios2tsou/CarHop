"""create availability_blocks table

Revision ID: i8f9a0b1c2d3
Revises: h7e8f9a0b1c2
Create Date: 2026-02-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "i8f9a0b1c2d3"
down_revision = "h7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "availability_blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "car_id",
            sa.Integer(),
            sa.ForeignKey("cars.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_availability_blocks_car_id", "availability_blocks", ["car_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_availability_blocks_car_id", table_name="availability_blocks")
    op.drop_table("availability_blocks")
