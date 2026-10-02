from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class StockState(Base):
    __tablename__ = "stock_states"
    __table_args__ = (UniqueConstraint("user_id", "symbol", name="uq_stock_states_user_symbol"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    symbol: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    is_favorite: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_watchlist: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class StockComment(Base):
    __tablename__ = "stock_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    symbol: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
