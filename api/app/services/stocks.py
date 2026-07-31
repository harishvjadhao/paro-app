from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ChartHighlight, Comment, Indicator, PriceBar, StockUniverse, WatchlistItem
from app.services.candles import Bar, bollinger_bands, ma44_series, select_timeframe, wilder_rsi
from app.services.indicators import above_ma, ma44, pct_vs_ma


def _latest_close_and_ma(db: Session, symbol: str) -> tuple[float | None, float | None, object | None]:
    bars = db.execute(
        select(PriceBar.close, PriceBar.date)
        .where(PriceBar.symbol == symbol)
        .order_by(PriceBar.date.desc())
        .limit(44)
    ).all()
    if not bars:
        return None, None, None
    # bars are desc; reverse for ma
    closes_asc = [float(c) for c, _ in reversed(bars)]
    last_close = closes_asc[-1]
    last_date = bars[0][1]
    # Prefer cached indicator if present
    cached = db.scalar(
        select(Indicator.ma44)
        .where(Indicator.symbol == symbol, Indicator.date == last_date)
    )
    m = float(cached) if cached is not None else ma44(closes_asc)
    return last_close, m, last_date


def list_stocks(
    db: Session,
    *,
    filter_mode: str = "all",
    q: str = "",
) -> list[dict]:
    user_id = settings.default_user_id
    stocks = list(
        db.scalars(
            select(StockUniverse).where(StockUniverse.active.is_(True)).order_by(
                StockUniverse.industry, StockUniverse.symbol
            )
        ).all()
    )
    wl_rows = {
        w.symbol: w
        for w in db.scalars(
            select(WatchlistItem).where(WatchlistItem.user_id == user_id)
        ).all()
    }
    q_norm = q.strip().upper()
    groups: dict[str, list[dict]] = {}
    for s in stocks:
        if q_norm and q_norm not in s.symbol.upper() and q_norm not in s.company.upper():
            continue
        wl = wl_rows.get(s.symbol)
        close, m, as_of = _latest_close_and_ma(db, s.symbol)
        above = bool(m is not None and close is not None and above_ma(close, m))
        pct = pct_vs_ma(close, m) if close is not None and m is not None else None

        if filter_mode == "ma" and not above:
            continue
        if filter_mode == "fav" and not (wl and wl.favorite):
            continue
        if filter_mode == "watch" and not (wl and wl.watchlist):
            continue

        item = {
            "symbol": s.symbol,
            "company": s.company,
            "industry": s.industry,
            "series": s.series,
            "isin": s.isin,
            "yahoo_symbol": s.yahoo_symbol,
            "close": close,
            "ma44": m,
            "above": above if m is not None else None,
            "pct_vs_ma": pct,
            "as_of": as_of.isoformat() if as_of else None,
            "favorite": bool(wl.favorite) if wl else False,
            "watchlist": bool(wl.watchlist) if wl else False,
            "industry_sort_order": wl.industry_sort_order if wl else 0,
        }
        groups.setdefault(s.industry, []).append(item)

    for industry, items in groups.items():
        items.sort(key=lambda x: (x["industry_sort_order"], x["symbol"]))

    return [
        {"industry": industry, "stocks": items}
        for industry, items in sorted(groups.items(), key=lambda kv: kv[0])
    ]


def stock_detail(db: Session, symbol: str) -> dict | None:
    s = db.scalar(
        select(StockUniverse).where(StockUniverse.symbol == symbol.upper(), StockUniverse.active.is_(True))
    )
    if not s:
        return None
    close, m, as_of = _latest_close_and_ma(db, s.symbol)
    return {
        "symbol": s.symbol,
        "company": s.company,
        "industry": s.industry,
        "series": s.series,
        "isin": s.isin,
        "yahoo_symbol": s.yahoo_symbol,
        "close": close,
        "ma44": m,
        "above": bool(m is not None and close is not None and above_ma(close, m)),
        "pct_vs_ma": pct_vs_ma(close, m) if close is not None and m is not None else None,
        "as_of": as_of.isoformat() if as_of else None,
    }


def candles_for_symbol(
    db: Session,
    symbol: str,
    *,
    timeframe: str = "D",
    bars: int = 44,
    indicators: list[str] | None = None,
) -> dict | None:
    symbol = symbol.upper()
    exists = db.scalar(select(StockUniverse.id).where(StockUniverse.symbol == symbol))
    if exists is None:
        return None

    # Need extra history for MA/BB/RSI warm-up on aggregated TF
    daily_rows = list(
        db.scalars(
            select(PriceBar).where(PriceBar.symbol == symbol).order_by(PriceBar.date.asc())
        ).all()
    )
    daily = [
        Bar(r.date, r.open, r.high, r.low, r.close, r.volume) for r in daily_rows
    ]
    series = select_timeframe(daily, timeframe)
    if not series:
        return {
            "symbol": symbol,
            "timeframe": timeframe.upper(),
            "bars": [],
            "ma44": [],
            "bb": None,
            "rsi": None,
            "highlights": [],
            "comments": [],
        }

    closes = [b.close for b in series]
    ma = ma44_series(closes)
    want = {i.strip().lower() for i in (indicators or []) if i.strip()}

    # Return last `bars` for display, but keep indicator alignment
    view = series[-bars:]
    offset = len(series) - len(view)

    payload: dict = {
        "symbol": symbol,
        "timeframe": timeframe.upper(),
        "bars": [
            {
                "date": b.date.isoformat(),
                "open": b.open,
                "high": b.high,
                "low": b.low,
                "close": b.close,
                "volume": b.volume,
            }
            for b in view
        ],
        "ma44": ma[offset:],
        "bb": None,
        "rsi": None,
        "highlights": [],
        "comments": [],
    }

    if "bb" in want:
        mid, up, lo = bollinger_bands(closes)
        payload["bb"] = {"mid": mid[offset:], "up": up[offset:], "lo": lo[offset:]}
    if "rsi" in want:
        payload["rsi"] = wilder_rsi(closes)[offset:]

    # Markers: daily only
    if timeframe.upper() == "D":
        dates = {b.date for b in view}
        highlights = db.scalars(select(ChartHighlight).order_by(ChartHighlight.date)).all()
        payload["highlights"] = [
            {"date": h.date.isoformat(), "label": h.label, "color": h.color}
            for h in highlights
            if h.date in dates
        ]
        comments = db.scalars(
            select(Comment).where(
                Comment.symbol == symbol, Comment.user_id == settings.default_user_id
            )
        ).all()
        payload["comments"] = [
            {
                "id": c.id,
                "date": c.created_at.date().isoformat() if c.created_at else None,
                "body": c.body,
            }
            for c in comments
        ]

    return payload
