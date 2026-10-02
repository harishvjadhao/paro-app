"""Add S2 sync tables.

Revision ID: 0003_s2_sync_tables
Revises: 0002_s1_universe_upload
Create Date: 2026-08-05 17:14:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0003_s2_sync_tables"
down_revision: Union[str, None] = "0002_s1_universe_upload"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "price_bars",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("o", sa.Float(), nullable=False),
        sa.Column("h", sa.Float(), nullable=False),
        sa.Column("l", sa.Float(), nullable=False),
        sa.Column("c", sa.Float(), nullable=False),
        sa.Column("v", sa.Float(), nullable=False),
        sa.UniqueConstraint("symbol", "date", name="uq_price_bars_symbol_date"),
    )
    op.create_index("ix_price_bars_symbol", "price_bars", ["symbol"], unique=False)
    op.create_index("ix_price_bars_symbol_date_desc", "price_bars", ["symbol", "date"], unique=False)

    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("scope", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.String(length=1000), nullable=True),
    )

    op.create_table(
        "sync_run_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("sync_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("window", sa.String(length=100), nullable=False, server_default="-"),
        sa.Column("message", sa.String(length=1000), nullable=False, server_default=""),
    )
    op.create_index("ix_sync_run_items_run_id", "sync_run_items", ["run_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sync_run_items_run_id", table_name="sync_run_items")
    op.drop_table("sync_run_items")
    op.drop_table("sync_runs")
    op.drop_index("ix_price_bars_symbol_date_desc", table_name="price_bars")
    op.drop_index("ix_price_bars_symbol", table_name="price_bars")
    op.drop_table("price_bars")
