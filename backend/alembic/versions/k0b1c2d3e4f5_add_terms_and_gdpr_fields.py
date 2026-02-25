"""add terms and gdpr fields

Revision ID: k0b1c2d3e4f5
Revises: j9a0b1c2d3e4
Create Date: 2026-02-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "k0b1c2d3e4f5"
down_revision = "j9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("gdpr_erasure_requested_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "gdpr_erasure_requested_at")
    op.drop_column("users", "terms_accepted_at")
