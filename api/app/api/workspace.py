from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.workspace import CommentIn, CommentOut, ReorderIn, WatchToggleOut
from app.services import workspace as ws

router = APIRouter(tags=["workspace"])


def _comment_out(c) -> CommentOut:
    return CommentOut(
        id=c.id,
        symbol=c.symbol,
        body=c.body,
        created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat(),
    )


@router.get("/stocks/{symbol}/comments", response_model=list[CommentOut])
def get_comments(symbol: str, db: Session = Depends(get_db)) -> list[CommentOut]:
    return [_comment_out(c) for c in ws.list_comments(db, symbol)]


@router.post("/stocks/{symbol}/comments", response_model=CommentOut)
def post_comment(symbol: str, body: CommentIn, db: Session = Depends(get_db)) -> CommentOut:
    return _comment_out(ws.add_comment(db, symbol, body.body))


@router.patch("/stocks/{symbol}/comments/{comment_id}", response_model=CommentOut)
def patch_comment(
    symbol: str, comment_id: int, body: CommentIn, db: Session = Depends(get_db)
) -> CommentOut:
    c = ws.patch_comment(db, comment_id, body.body)
    if not c:
        raise HTTPException(status_code=404, detail="comment not found")
    return _comment_out(c)


@router.delete("/stocks/{symbol}/comments/{comment_id}")
def delete_comment(symbol: str, comment_id: int, db: Session = Depends(get_db)) -> dict:
    if not ws.delete_comment(db, comment_id):
        raise HTTPException(status_code=404, detail="comment not found")
    return {"ok": True}


@router.post("/watchlist/{symbol}/favorite", response_model=WatchToggleOut)
def fav(symbol: str, db: Session = Depends(get_db)) -> WatchToggleOut:
    item = ws.toggle_favorite(db, symbol)
    return WatchToggleOut(symbol=item.symbol, favorite=item.favorite, watchlist=item.watchlist)


@router.post("/watchlist/{symbol}/watch", response_model=WatchToggleOut)
def watch(symbol: str, db: Session = Depends(get_db)) -> WatchToggleOut:
    item = ws.toggle_watchlist(db, symbol)
    return WatchToggleOut(symbol=item.symbol, favorite=item.favorite, watchlist=item.watchlist)


@router.post("/watchlist/reorder")
def reorder(body: ReorderIn, db: Session = Depends(get_db)) -> dict:
    ws.reorder_industry(db, body.industry, body.symbols)
    return {"ok": True}
