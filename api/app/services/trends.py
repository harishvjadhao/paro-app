from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from statistics import fmean
from urllib.parse import unquote

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domain.indicators import above_ma, pct_vs_ma, sma
from app.domain.sectors import stock_week_above_share, week_window, weekly_breadth_series
from app.repositories.workspace import WorkspaceRepository
from app.schemas.trends import (
    TrendCell,
    TrendDrillResponse,
    TrendDrillStock,
    TrendSectorRow,
    TrendWeek,
    WeeklyTrendsResponse,
)

WEEKS = 8
WEEK_DAYS = 5


def _format_week_label(iso_date: str) -> str:
    """Format an ISO date (YYYY-MM-DD) as a short 'Mon D' label (e.g. 'Jan 15')."""
    try:
        parsed = datetime.strptime(iso_date, "%Y-%m-%d")
    except ValueError:
        return iso_date[5:] if len(iso_date) >= 7 else iso_date
    return f"{parsed.strftime('%b')} {parsed.day}"


class TrendsService:
    def __init__(self, repo: WorkspaceRepository | None = None) -> None:
        self.repo = repo or WorkspaceRepository()

    def weekly_matrix(self, db: Session) -> WeeklyTrendsResponse:
        prepared = self._prepare(db)
        weeks = prepared["weeks"]
        rows = prepared["rows"]
        if not rows:
            return WeeklyTrendsResponse(weeks=weeks, sectors=[], summary="No active universe.")
        avg_breadth = round(fmean(row.avg for row in rows), 1)
        strongest = rows[0].name
        summary = f"Average breadth {avg_breadth}% · strongest: {strongest}"
        return WeeklyTrendsResponse(weeks=weeks, sectors=rows, summary=summary)

    def weekly_drill(self, db: Session, sector: str, week_index: int) -> TrendDrillResponse:
        name = unquote(sector)
        if week_index < 0 or week_index >= WEEKS:
            raise HTTPException(status_code=400, detail="weekIndex must be 0..7")

        prepared = self._prepare(db)
        sector_data = prepared["by_sector"].get(name)
        if sector_data is None:
            raise HTTPException(status_code=404, detail="Sector not found")

        weeks = prepared["weeks"]
        week = weeks[week_index]
        cell = sector_data["cells"][week_index]
        stocks_payload: list[TrendDrillStock] = []
        above_count = 0
        for item in sector_data["stocks"]:
            share = stock_week_above_share(item["flags"], week_index, week_days=WEEK_DAYS, weeks=WEEKS)
            mostly_above = share >= 0.5
            if mostly_above:
                above_count += 1
            # Flipped = last day of prior week vs majority of this week when possible.
            flipped = False
            flags = item["flags"]
            if flags:
                prev_index = week_index - 1
                if prev_index >= 0:
                    prev_share = stock_week_above_share(flags, prev_index, week_days=WEEK_DAYS, weeks=WEEKS)
                    flipped = (prev_share >= 0.5) != mostly_above
            stocks_payload.append(
                TrendDrillStock(
                    symbol=item["symbol"],
                    company=item["company"],
                    pct_vs_ma44=item["pct_vs_ma44"],
                    above_ma44=mostly_above,
                    week_above_share=round(share * 100.0, 1),
                    flipped=flipped,
                )
            )

        stocks_payload.sort(key=lambda row: row.pct_vs_ma44, reverse=True)
        return TrendDrillResponse(
            sector=name,
            week_index=week_index,
            week_label=week.label,
            end_date=week.end_date,
            pct=cell.pct,
            avg_above=cell.avg_above,
            total=cell.total,
            above_count=above_count,
            stocks=stocks_payload,
        )

    def _prepare(self, db: Session) -> dict:
        universe = self.repo.list_universe(db)
        by_industry: dict[str, list] = defaultdict(list)
        for stock in universe:
            by_industry[stock.industry].append(stock)

        label_dates: list[str] = []
        by_sector: dict[str, dict] = {}
        rows: list[TrendSectorRow] = []

        for industry, stocks in sorted(by_industry.items()):
            matrix: list[list[bool]] = []
            stock_rows: list[dict] = []
            for stock in stocks:
                bars = self.repo.list_daily_bars(db, stock.symbol, limit=120)
                if not bars:
                    stock_rows.append(
                        {
                            "symbol": stock.symbol,
                            "company": stock.company,
                            "flags": [],
                            "pct_vs_ma44": 0.0,
                        }
                    )
                    continue
                closes = [float(bar.c) for bar in bars]
                dates = [bar.date.isoformat() for bar in bars]
                ma_series = sma(closes, 44)
                flags = [
                    above_ma(closes[idx], ma_series[idx]) if ma_series[idx] is not None else False
                    for idx in range(len(closes))
                ]
                close = closes[-1]
                ma44 = ma_series[-1]
                stock_rows.append(
                    {
                        "symbol": stock.symbol,
                        "company": stock.company,
                        "flags": flags,
                        "pct_vs_ma44": round(pct_vs_ma(close, ma44), 2),
                    }
                )
                matrix.append(flags)
                if len(dates) > len(label_dates):
                    label_dates = dates

            with_data = [row["flags"] for row in stock_rows if row["flags"]]
            aligned = self._align_matrix(with_data)
            cells_raw = weekly_breadth_series(aligned, week_days=WEEK_DAYS, weeks=WEEKS)
            cells = [
                TrendCell(
                    week_index=index,
                    pct=cell["pct"],
                    avg_above=cell["avg_above"],
                    total=len(stocks),
                )
                for index, cell in enumerate(cells_raw)
            ]
            avg = round(fmean(cell.pct for cell in cells), 1) if cells else 0.0
            row = TrendSectorRow(name=industry, total=len(stocks), cells=cells, avg=avg)
            rows.append(row)
            by_sector[industry] = {"cells": cells, "stocks": stock_rows}

        rows.sort(key=lambda item: item.avg, reverse=True)
        weeks = self._week_labels(label_dates)
        return {"weeks": weeks, "rows": rows, "by_sector": by_sector}

    @staticmethod
    def _align_matrix(matrix: list[list[bool]]) -> list[list[bool]]:
        if not matrix:
            return []
        length = min(len(row) for row in matrix)
        return [row[-length:] for row in matrix]

    @staticmethod
    def _week_labels(dates: list[str]) -> list[TrendWeek]:
        if not dates:
            return [
                TrendWeek(index=index, label=f"W{index + 1}", end_date="")
                for index in range(WEEKS)
            ]
        length = len(dates)
        weeks: list[TrendWeek] = []
        for index in range(WEEKS):
            _start, end = week_window(length, index, week_days=WEEK_DAYS, weeks=WEEKS)
            end_idx = max(0, end - 1)
            end_date = dates[end_idx]
            weeks.append(TrendWeek(index=index, label=_format_week_label(end_date), end_date=end_date))
        return weeks
