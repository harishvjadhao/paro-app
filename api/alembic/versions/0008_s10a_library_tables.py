"""Add S10a library tables (books, pages, jobs, suggestions).

Revision ID: 0008_s10a_library_tables
Revises: 0007_s8_highlight_tables
Create Date: 2026-08-31 23:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_s10a_library_tables"
down_revision: Union[str, None] = "0007_s8_highlight_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("author", sa.String(length=180), nullable=False, server_default=""),
        sa.Column("subtitle", sa.String(length=320), nullable=False, server_default=""),
        sa.Column("tag", sa.String(length=80), nullable=False, server_default="Book"),
        sa.Column("spine_color", sa.String(length=20), nullable=False, server_default="#3C2CDA"),
        sa.Column("kind", sa.String(length=20), nullable=False, server_default="text"),
        sa.Column("source_filename", sa.String(length=260), nullable=False),
        sa.Column("storage_key", sa.String(length=400), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="queued"),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ocr_confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_books_status", "books", ["status"], unique=False)

    op.create_table(
        "book_pages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_index", sa.Integer(), nullable=False),
        sa.Column("chapter", sa.String(length=240), nullable=False, server_default=""),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
    )
    op.create_index("ix_book_pages_book_id", "book_pages", ["book_id"], unique=False)

    op.create_table(
        "ingestion_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("state", sa.String(length=40), nullable=False, server_default="queued"),
        sa.Column("pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stage_message", sa.String(length=240), nullable=False, server_default=""),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_ingestion_jobs_book_id", "ingestion_jobs", ["book_id"], unique=False)

    op.create_table(
        "book_suggestions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.String(length=400), nullable=False),
    )
    op.create_index("ix_book_suggestions_book_id", "book_suggestions", ["book_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_book_suggestions_book_id", table_name="book_suggestions")
    op.drop_table("book_suggestions")
    op.drop_index("ix_ingestion_jobs_book_id", table_name="ingestion_jobs")
    op.drop_table("ingestion_jobs")
    op.drop_index("ix_book_pages_book_id", table_name="book_pages")
    op.drop_table("book_pages")
    op.drop_index("ix_books_status", table_name="books")
    op.drop_table("books")
