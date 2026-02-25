"""create damage_reports table

Revision ID: g6d7e8f9a0b1
Revises: f5c6d7e8a9b0
Create Date: 2026-02-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "g6d7e8f9a0b1"
down_revision = "f5c6d7e8a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "damage_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "booking_id",
            sa.Integer(),
            sa.ForeignKey("bookings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reporter_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("estimated_cost_pence", sa.Integer(), nullable=True),
        sa.Column("photo_keys", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(),
            nullable=False,
            server_default="OPEN",
        ),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_damage_reports_booking_id", "damage_reports", ["booking_id"], unique=True)
    op.create_index("ix_damage_reports_status", "damage_reports", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_damage_reports_status", table_name="damage_reports")
    op.drop_index("ix_damage_reports_booking_id", table_name="damage_reports")
    op.drop_table("damage_reports")
