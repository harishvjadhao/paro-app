from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Comment, WatchlistItem


def list_comments(db: Session, symbol: str) -> list[Comment]:
    return list(
        db.scalars(
            select(Comment)
            .where(
                Comment.symbol == symbol.upper(),
                Comment.user_id == settings.default_user_id,
            )
            .order_by(Comment.created_at.desc())
        ).all()
    )


def add_comment(db: Session, symbol: str, body: str) -> Comment:
    c = Comment(user_id=settings.default_user_id, symbol=symbol.upper(), body=body.strip())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def patch_comment(db: Session, comment_id: int, body: str) -> Comment | None:
    c = db.get(Comment, comment_id)
    if not c or c.user_id != settings.default_user_id:
        return None
    c.body = body.strip()
    db.commit()
    db.refresh(c)
    return c


def delete_comment(db: Session, comment_id: int) -> bool:
    c = db.get(Comment, comment_id)
    if not c or c.user_id != settings.default_user_id:
        return False
    db.delete(c)
    db.commit()
    return True


def _get_or_create_wl(db: Session, symbol: str) -> WatchlistItem:
    item = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.user_id == settings.default_user_id,
            WatchlistItem.symbol == symbol.upper(),
        )
    )
    if item:
        return item
    item = WatchlistItem(
        user_id=settings.default_user_id,
        symbol=symbol.upper(),
        favorite=False,
        watchlist=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def toggle_favorite(db: Session, symbol: str) -> WatchlistItem:
    item = _get_or_create_wl(db, symbol)
    item.favorite = not item.favorite
    db.commit()
    db.refresh(item)
    return item


def toggle_watchlist(db: Session, symbol: str) -> WatchlistItem:
    item = _get_or_create_wl(db, symbol)
    item.watchlist = not item.watchlist
    db.commit()
    db.refresh(item)
    return item


def reorder_industry(db: Session, industry: str, symbols: list[str]) -> None:
    for i, sym in enumerate(symbols):
        item = _get_or_create_wl(db, sym)
        item.industry_sort_order = i
    db.commit()
