"""0002_phase6_books

Revision ID: 0002_books
Revises: 0001_phase0
Create Date: 2026-07-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0002_books"
down_revision: Union[str, None] = "0001_phase0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBED_DIM = 1536


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("author", sa.String(256), nullable=False, server_default=""),
        sa.Column("subtitle", sa.String(512), nullable=False, server_default=""),
        sa.Column("tag", sa.String(64), nullable=False, server_default=""),
        sa.Column("spine_color", sa.String(16), nullable=False, server_default="#3C2CDA"),
        sa.Column("kind", sa.String(16), nullable=False, server_default="text"),
        sa.Column("source_filename", sa.String(512), nullable=False),
        sa.Column("storage_key", sa.String(1024), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="queued"),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ocr_confidence", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_table(
        "book_pages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE")),
        sa.Column("page_index", sa.Integer(), nullable=False),
        sa.Column("chapter", sa.String(256), nullable=False, server_default=""),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
        sa.UniqueConstraint("book_id", "page_index", name="uq_book_page"),
    )

    op.create_table(
        "book_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE")),
        sa.Column("page_index", sa.Integer(), nullable=False),
        sa.Column("chapter", sa.String(256), nullable=False, server_default=""),
        sa.Column("ord", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("char_start", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("char_end", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("embedding", Vector(EMBED_DIM), nullable=True),
    )
    op.create_index("ix_book_chunks_book_id", "book_chunks", ["book_id"])
    op.create_index("ix_book_chunks_page_index", "book_chunks", ["page_index"])

    op.create_table(
        "book_suggestions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE")),
        sa.Column("question", sa.Text(), nullable=False),
    )

    op.create_table(
        "ingestion_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE")),
        sa.Column("state", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stage_message", sa.String(256), nullable=False, server_default=""),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "reading_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE")),
        sa.Column("page_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "book_id", name="uq_reading_progress"),
    )

    op.create_table(
        "book_bookmarks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE")),
        sa.Column("page_index", sa.Integer(), nullable=False),
        sa.UniqueConstraint("user_id", "book_id", "page_index", name="uq_book_bookmark"),
    )

    op.create_table(
        "book_highlights",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE")),
        sa.Column("page_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    for t in (
        "book_highlights",
        "book_bookmarks",
        "reading_progress",
        "ingestion_jobs",
        "book_suggestions",
        "book_chunks",
        "book_pages",
        "books",
    ):
        op.drop_table(t)
