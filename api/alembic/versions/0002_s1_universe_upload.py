"""Add S1 universe tables.

Revision ID: 0002_s1_universe_upload
Revises: 0001_s0_foundation
Create Date: 2026-08-05 16:18:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_s1_universe_upload"
down_revision: Union[str, None] = "0001_s0_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_universe",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("company", sa.String(length=255), nullable=False),
        sa.Column("industry", sa.String(length=255), nullable=False),
        sa.Column("series", sa.String(length=40), nullable=False),
        sa.Column("isin", sa.String(length=80), nullable=False),
        sa.Column("yahoo_symbol", sa.String(length=80), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("symbol", name="uq_stock_universe_symbol"),
    )
    op.create_index("ix_stock_universe_symbol", "stock_universe", ["symbol"], unique=True)

    op.create_table(
        "universe_uploads",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("dup", sa.Integer(), nullable=False),
        sa.Column("invalid", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("universe_uploads")
    op.drop_index("ix_stock_universe_symbol", table_name="stock_universe")
    op.drop_table("stock_universe")
