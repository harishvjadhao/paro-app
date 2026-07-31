"""0001_phase0_core_tables

Revision ID: 0001_phase0
Revises:
Create Date: 2026-07-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_phase0"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "universe_uploads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("filename", sa.String(256), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicates", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("invalid", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("uploaded_by", sa.Integer(), nullable=False, server_default="1"),
    )

    op.create_table(
        "stock_universe",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("company", sa.String(256), nullable=False),
        sa.Column("industry", sa.String(128), nullable=False),
        sa.Column("series", sa.String(16), nullable=False, server_default="EQ"),
        sa.Column("isin", sa.String(16), nullable=False, server_default=""),
        sa.Column("yahoo_symbol", sa.String(40), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("uploaded_batch_id", sa.Integer(), sa.ForeignKey("universe_uploads.id")),
    )
    op.create_index("ix_stock_universe_symbol", "stock_universe", ["symbol"], unique=True)
    op.create_index("ix_stock_universe_industry", "stock_universe", ["industry"])

    op.create_table(
        "price_bars",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("open", sa.Float(), nullable=False),
        sa.Column("high", sa.Float(), nullable=False),
        sa.Column("low", sa.Float(), nullable=False),
        sa.Column("close", sa.Float(), nullable=False),
        sa.Column("volume", sa.Float(), nullable=False, server_default="0"),
        sa.UniqueConstraint("symbol", "date", name="uq_price_bars_symbol_date"),
    )
    op.create_index("ix_price_bars_symbol", "price_bars", ["symbol"])
    op.create_index("ix_price_bars_date", "price_bars", ["date"])

    op.create_table(
        "indicators",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("ma44", sa.Float(), nullable=False),
        sa.UniqueConstraint("symbol", "date", name="uq_indicators_symbol_date"),
    )
    op.create_index("ix_indicators_symbol", "indicators", ["symbol"])

    op.create_table(
        "watchlist_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("favorite", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("watchlist", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("industry_sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("user_id", "symbol", name="uq_watchlist_user_symbol"),
    )
    op.create_index("ix_watchlist_items_user_id", "watchlist_items", ["user_id"])

    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_comments_user_id", "comments", ["user_id"])
    op.create_index("ix_comments_symbol", "comments", ["symbol"])

    op.create_table(
        "chart_highlights",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("label", sa.String(128), nullable=False),
        sa.Column("color", sa.String(16), nullable=False),
    )
    op.create_index("ix_chart_highlights_date", "chart_highlights", ["date"])

    op.create_table(
        "journal_trades",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("segment", sa.String(16), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("buy_price", sa.Float(), nullable=False),
        sa.Column("sell_price", sa.Float(), nullable=True),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("exit_date", sa.Date(), nullable=True),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_journal_trades_user_id", "journal_trades", ["user_id"])
    op.create_index("ix_journal_trades_symbol", "journal_trades", ["symbol"])

    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="running"),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.Text(), nullable=True),
    )

    op.create_table(
        "sync_run_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("sync_runs.id"), nullable=False),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("status", sa.String(8), nullable=False),
        sa.Column("rows_written", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("window_start", sa.Date(), nullable=True),
        sa.Column("window_end", sa.Date(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
    )
    op.create_index("ix_sync_run_items_run_id", "sync_run_items", ["run_id"])


def downgrade() -> None:
    op.drop_table("sync_run_items")
    op.drop_table("sync_runs")
    op.drop_table("journal_trades")
    op.drop_table("chart_highlights")
    op.drop_table("comments")
    op.drop_table("watchlist_items")
    op.drop_table("indicators")
    op.drop_table("price_bars")
    op.drop_table("stock_universe")
    op.drop_table("universe_uploads")
