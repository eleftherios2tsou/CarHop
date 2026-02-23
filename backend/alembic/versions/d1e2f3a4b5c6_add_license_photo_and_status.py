"""add verification photos and status to driver_licenses

Revision ID: d1e2f3a4b5c6
Revises: b7f2c41d9a33
Create Date: 2026-02-23 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "b7f2c41d9a33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("driver_licenses", sa.Column("license_photo_key", sa.String(), nullable=True))
    op.add_column("driver_licenses", sa.Column("license_photo_url", sa.String(), nullable=True))
    op.add_column("driver_licenses", sa.Column("selfie_key", sa.String(), nullable=True))
    op.add_column("driver_licenses", sa.Column("selfie_url", sa.String(), nullable=True))
    op.add_column(
        "driver_licenses",
        sa.Column(
            "verification_status",
            sa.String(),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column("driver_licenses", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("driver_licenses", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("driver_licenses", sa.Column("rejection_reason", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("driver_licenses", "rejection_reason")
    op.drop_column("driver_licenses", "verified_at")
    op.drop_column("driver_licenses", "submitted_at")
    op.drop_column("driver_licenses", "verification_status")
    op.drop_column("driver_licenses", "selfie_url")
    op.drop_column("driver_licenses", "selfie_key")
    op.drop_column("driver_licenses", "license_photo_url")
    op.drop_column("driver_licenses", "license_photo_key")
