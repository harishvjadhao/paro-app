from __future__ import annotations

from collections import defaultdict
from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domain.indicators import aggregate, above_ma, bollinger, pct_vs_ma, rsi_wilder, sma
from app.providers.prices import PriceProvider, YFinanceProvider
from app.repositories.highlights import HighlightsRepository
from app.repositories.workspace import WorkspaceRepository
from app.schemas.workspace import CandleResponse, ChartMarker, StockCommentResponse


class WorkspaceService:
    def __init__(
        self,
        repo: WorkspaceRepository | None = None,
        provider: PriceProvider | None = None,
        highlights_repo: HighlightsRepository | None = None,
    ) -> None:
        self.repo = repo or WorkspaceRepository()
        self.provider = provider or YFinanceProvider()
        self.highlights_repo = highlights_repo or HighlightsRepository()

    def list_stocks(self, db: Session, *, filter_key: str, q: str) -> list[dict[str, object]]:
        universe = self.repo.list_universe(db)
        states = {state.symbol: state for state in self.repo.list_states(db)}

        enriched: list[dict[str, object]] = []
        needle = q.strip().lower()

        for stock in universe:
            state = states.get(stock.symbol)
            bars = self.repo.list_daily_bars(db, stock.symbol, limit=60)
            if len(bars) < 44:
                self._ensure_symbol_bars(db, stock.symbol)
                bars = self.repo.list_daily_bars(db, stock.symbol, limit=60)

            closes = [float(bar.c) for bar in bars]
            ma_series = sma(closes, 44)
            ma44 = ma_series[-1] if ma_series else None
            close = closes[-1] if closes else 0.0
            pct = pct_vs_ma(close, ma44)
            is_above = above_ma(close, ma44)
            is_fav = bool(state.is_favorite) if state else False
            is_watch = bool(state.is_watchlist) if state else False

            item = {
                "symbol": stock.symbol,
                "company": stock.company,
                "industry": stock.industry,
                "series": stock.series,
                "isin": stock.isin,
                "yahoo_symbol": stock.yahoo_symbol,
                "close": round(close, 2),
                "ma44": round(ma44, 2) if ma44 is not None else None,
                "pct_vs_ma44": round(pct, 2),
                "above_ma44": is_above,
                "is_favorite": is_fav,
                "is_watchlist": is_watch,
                "last_sync": str(bars[-1].date) if bars else "-",
                "order_index": state.order_index if state else 9999,
            }

            if needle and not self._matches_query(item, needle):
                continue

            if filter_key == "ma" and not is_above:
                continue
            if filter_key == "fav" and not is_fav:
                continue
            if filter_key == "watch" and not is_watch:
                continue

            enriched.append(item)

        grouped = defaultdict(list)
        for item in enriched:
            grouped[item["industry"]].append(item)

        rows: list[dict[str, object]] = []
        for industry in sorted(grouped.keys()):
            ordered = sorted(grouped[industry], key=lambda x: (int(x["order_index"]), str(x["symbol"])))
            rows.extend(ordered)
        return rows

    def stock_detail(self, db: Session, symbol: str) -> dict[str, object]:
        sym = symbol.upper()
        stock = self.repo.get_universe_symbol(db, sym)
        if stock is None:
            raise HTTPException(status_code=404, detail="Stock not found in universe")

        state = self.repo.get_or_create_state(db, sym)
        bars = self.repo.list_daily_bars(db, sym, limit=80)
        if len(bars) < 44:
            self._ensure_symbol_bars(db, sym)
            bars = self.repo.list_daily_bars(db, sym, limit=80)

        closes = [float(bar.c) for bar in bars]
        ma_series = sma(closes, 44)
        ma44 = ma_series[-1] if ma_series else None
        close = closes[-1] if closes else 0.0

        comments = self.repo.list_comments(db, sym)
        comment_payload = [StockCommentResponse.model_validate(item, from_attributes=True).model_dump() for item in comments]

        return {
            "symbol": stock.symbol,
            "company": stock.company,
            "industry": stock.industry,
            "series": stock.series,
            "isin": stock.isin,
            "yahoo_symbol": stock.yahoo_symbol,
            "close": round(close, 2),
            "ma44": round(ma44, 2) if ma44 is not None else None,
            "pct_vs_ma44": round(pct_vs_ma(close, ma44), 2),
            "above_ma44": above_ma(close, ma44),
            "is_favorite": bool(state.is_favorite),
            "is_watchlist": bool(state.is_watchlist),
            "last_sync": str(bars[-1].date) if bars else "-",
            "comments": comment_payload,
        }

    def candles(
        self,
        db: Session,
        symbol: str,
        timeframe: str,
        bars: int,
        indicators: str,
    ) -> CandleResponse:
        sym = symbol.upper()
        if timeframe not in {"D", "W", "M"}:
            raise HTTPException(status_code=400, detail="Invalid timeframe")

        daily = self.repo.list_daily_bars(db, sym, limit=800)
        if len(daily) < 60:
            self._ensure_symbol_bars(db, sym)
            daily = self.repo.list_daily_bars(db, sym, limit=800)

        rows = [
            {
                "date": item.date.isoformat(),
                "o": float(item.o),
                "h": float(item.h),
                "l": float(item.l),
                "c": float(item.c),
                "v": float(item.v),
            }
            for item in daily
        ]
        tf_rows = aggregate(rows, timeframe) if timeframe in {"W", "M"} else rows

        closes = [float(item["c"]) for item in tf_rows]
        ma_values = sma(closes, 44)

        with_bb = "bb" in indicators
        with_rsi = "rsi" in indicators
        bb_values = bollinger(closes, 20, 2.0) if with_bb else [(None, None, None)] * len(tf_rows)
        rsi_values = rsi_wilder(closes, 14) if with_rsi else [None] * len(tf_rows)

        payload: list[dict[str, object]] = []
        for idx, row in enumerate(tf_rows):
            bb_upper, bb_mid, bb_lower = bb_values[idx]
            payload.append(
                {
                    "date": str(row["date"]),
                    "o": float(row["o"]),
                    "h": float(row["h"]),
                    "l": float(row["l"]),
                    "c": float(row["c"]),
                    "v": float(row["v"]),
                    "ma44": round(float(ma_values[idx]), 4) if ma_values[idx] is not None else None,
                    "bb_upper": round(float(bb_upper), 4) if bb_upper is not None else None,
                    "bb_mid": round(float(bb_mid), 4) if bb_mid is not None else None,
                    "bb_lower": round(float(bb_lower), 4) if bb_lower is not None else None,
                    "rsi14": round(float(rsi_values[idx]), 4) if rsi_values[idx] is not None else None,
                }
            )

        trimmed = payload[-bars:] if bars > 0 else payload
        markers: list[ChartMarker] = []
        if timeframe == "D" and trimmed:
            bar_dates = {str(item["date"]) for item in trimmed}
            sorted_dates = [str(item["date"]) for item in trimmed]
            comments = self.repo.list_comments(db, sym)
            for comment in comments:
                comment_day = comment.created_at.date().isoformat()
                marker_date = comment_day if comment_day in bar_dates else None
                if marker_date is None:
                    earlier = [d for d in sorted_dates if d <= comment_day]
                    marker_date = earlier[-1] if earlier else sorted_dates[-1]
                markers.append(
                    ChartMarker(
                        date=marker_date,
                        kind="comment",
                        id=comment.id,
                        label=(comment.body[:48] + "…") if len(comment.body) > 48 else comment.body,
                        color="#6B7280",
                    )
                )

            window_start = date.fromisoformat(sorted_dates[0])
            window_end = date.fromisoformat(sorted_dates[-1])
            highlights = self.highlights_repo.list_for_symbol_window(
                db,
                symbol=sym,
                window_start=window_start,
                window_end=window_end,
            )
            for highlight in highlights:
                for day in sorted_dates:
                    day_date = date.fromisoformat(day)
                    if highlight.date_from <= day_date <= highlight.date_to:
                        markers.append(
                            ChartMarker(
                                date=day,
                                kind="highlight",
                                id=highlight.id,
                                label=highlight.label,
                                color=highlight.color,
                            )
                        )

        return CandleResponse(symbol=sym, timeframe=timeframe, bars=trimmed, markers=markers)

    def toggle_favorite(self, db: Session, symbol: str) -> dict[str, object]:
        state = self.repo.get_or_create_state(db, symbol.upper())
        state.is_favorite = 0 if state.is_favorite else 1
        db.add(state)
        db.commit()
        db.refresh(state)
        return {"symbol": state.symbol, "is_favorite": bool(state.is_favorite), "is_watchlist": bool(state.is_watchlist)}

    def toggle_watchlist(self, db: Session, symbol: str) -> dict[str, object]:
        state = self.repo.get_or_create_state(db, symbol.upper())
        state.is_watchlist = 0 if state.is_watchlist else 1
        db.add(state)
        db.commit()
        db.refresh(state)
        return {"symbol": state.symbol, "is_favorite": bool(state.is_favorite), "is_watchlist": bool(state.is_watchlist)}

    def add_comment(self, db: Session, symbol: str, body: str) -> dict[str, object]:
        cleaned = body.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Comment body is required")
        comment = self.repo.add_comment(db, symbol.upper(), cleaned)
        db.commit()
        db.refresh(comment)
        return StockCommentResponse.model_validate(comment, from_attributes=True).model_dump()

    def update_comment(self, db: Session, symbol: str, comment_id: int, body: str) -> dict[str, object]:
        cleaned = body.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Comment body is required")
        comment = self.repo.update_comment(db, comment_id, cleaned)
        if comment is None or comment.symbol != symbol.upper():
            raise HTTPException(status_code=404, detail="Comment not found")
        db.commit()
        db.refresh(comment)
        return StockCommentResponse.model_validate(comment, from_attributes=True).model_dump()

    def delete_comment(self, db: Session, symbol: str, comment_id: int) -> dict[str, bool]:
        existing = self.repo.delete_comment(db, comment_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Comment not found")
        db.commit()
        return {"deleted": True}

    def reorder_group(self, db: Session, industry: str, symbols: list[str]) -> dict[str, int]:
        if not symbols:
            raise HTTPException(status_code=400, detail="No symbols provided")
        self.repo.set_group_order(db, industry, symbols)
        db.commit()
        return {"updated": len(symbols)}

    def _ensure_symbol_bars(self, db: Session, symbol: str) -> None:
        last_rows = self.repo.list_daily_bars(db, symbol, limit=1)
        last_date: date | None = last_rows[0].date if last_rows else None
        mode = "full" if last_date is None else "incremental"
        bars = self.provider.fetch_daily_bars(symbol, mode, last_date)
        if not bars:
            return
        self.repo.upsert_bar_rows(db, symbol, bars)
        db.commit()

    def _matches_query(self, row: dict[str, object], needle: str) -> bool:
        return (
            needle in str(row["symbol"]).lower()
            or needle in str(row["company"]).lower()
            or needle in str(row["industry"]).lower()
        )
