from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class StockMeta(Base):
    __tablename__ = "stock_meta"

    symbol: Mapped[str] = mapped_column(String(40), primary_key=True)
    subcategory: Mapped[str] = mapped_column(String(120), nullable=False, default="", server_default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    screen: Mapped[str | None] = mapped_column(String(40), nullable=True)
    ma_d_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ma_w_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ma_m_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    custom_values: Mapped[str] = mapped_column(Text, nullable=False, default="{}", server_default="{}")
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class StockListColumn(Base):
    __tablename__ = "stock_list_columns"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_stock_list_columns_user_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[str] = mapped_column(String(40), nullable=False, default="text", server_default="text")
    options_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    hidden: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
