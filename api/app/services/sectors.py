from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from urllib.parse import unquote

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domain.indicators import above_ma, pct_vs_ma, sma
from app.domain.sectors import breadth_pct, rotation_coordinates, weekly_breadth_series
from app.repositories.workspace import WorkspaceRepository
from app.schemas.sectors import (
    SectorCompareResponse,
    SectorCompareSeries,
    SectorConstituent,
    SectorDetail,
    SectorListResponse,
    SectorSummary,
    WeeklyBreadthPoint,
)

COMPARE_COLORS = [
    "#3C2CDA",
    "#12A053",
    "#DC3545",
    "#EA9D00",
    "#0EA5E9",
    "#8B5CF6",
    "#F97316",
    "#14B8A6",
    "#64748B",
    "#DB2777",
]


class SectorService:
    def __init__(self, repo: WorkspaceRepository | None = None) -> None:
        self.repo = repo or WorkspaceRepository()

    def list_sectors(self, db: Session) -> SectorListResponse:
        bundles = self._build_sector_bundles(db)
        summaries = [self._summary_from_bundle(name, bundle) for name, bundle in bundles.items()]
        summaries.sort(key=lambda item: item.breadth, reverse=True)
        return SectorListResponse(sectors=summaries)

    def sector_detail(self, db: Session, sector: str) -> SectorDetail:
        name = unquote(sector)
        bundles = self._build_sector_bundles(db)
        bundle = bundles.get(name)
        if bundle is None:
            raise HTTPException(status_code=404, detail="Sector not found")

        constituents = sorted(bundle["constituents"], key=lambda item: item.pct_vs_ma44, reverse=True)
        above = sum(1 for item in constituents if item.above_ma44)
        below = len(constituents) - above
        avg_pct = (
            round(sum(item.pct_vs_ma44 for item in constituents) / len(constituents), 2) if constituents else 0.0
        )
        advancers = sum(1 for item in constituents if item.pct_vs_ma44 >= 0)
        decliners = len(constituents) - advancers
        weekly = bundle["weekly"]
        weekly_pcts = [point.pct for point in weekly]
        avg8, momentum = rotation_coordinates(weekly_pcts)
        return SectorDetail(
            name=name,
            total=len(constituents),
            above=above,
            below=below,
            breadth=round(breadth_pct([item.above_ma44 for item in constituents]), 2),
            avg_pct_vs_ma=avg_pct,
            advancers=advancers,
            decliners=decliners,
            avg8=avg8,
            momentum=momentum,
            leader=constituents[0] if constituents else None,
            laggard=constituents[-1] if constituents else None,
            constituents=constituents,
            weekly_trend=weekly,
            rotation_x=avg8,
            rotation_y=momentum,
        )

    def compare(self, db: Session, a: str | None = None, b: str | None = None) -> SectorCompareResponse:
        bundles = self._build_sector_bundles(db)
        names = sorted(bundles.keys(), key=lambda name: bundles[name]["summary"].breadth, reverse=True)
        selected_a = unquote(a) if a else (names[0] if names else None)
        selected_b = unquote(b) if b else (names[1] if len(names) > 1 else selected_a)

        series: list[SectorCompareSeries] = []
        for index, name in enumerate(names):
            series.append(
                SectorCompareSeries(
                    name=name,
                    color=COMPARE_COLORS[index % len(COMPARE_COLORS)],
                    points=bundles[name]["weekly"],
                    selected=name in {selected_a, selected_b},
                )
            )
        return SectorCompareResponse(sectors=series, a=selected_a, b=selected_b)

    def _summary_from_bundle(self, name: str, bundle: dict) -> SectorSummary:
        return bundle["summary"]

    def _build_sector_bundles(self, db: Session) -> dict[str, dict]:
        universe = self.repo.list_universe(db)
        by_industry: dict[str, list] = defaultdict(list)
        for stock in universe:
            by_industry[stock.industry].append(stock)

        # Align week labels from the richest bar history available.
        week_labels = self._default_week_labels()
        bundles: dict[str, dict] = {}

        for industry, stocks in by_industry.items():
            constituents: list[SectorConstituent] = []
            above_matrix: list[list[bool]] = []
            label_source: list[str] = []

            for stock in stocks:
                bars = self.repo.list_daily_bars(db, stock.symbol, limit=120)
                if not bars:
                    constituents.append(
                        SectorConstituent(
                            symbol=stock.symbol,
                            company=stock.company,
                            close=0.0,
                            ma44=None,
                            pct_vs_ma44=0.0,
                            above_ma44=False,
                            sparkline=[],
                        )
                    )
                    continue

                closes = [float(bar.c) for bar in bars]
                dates = [bar.date.isoformat() for bar in bars]
                ma_series = sma(closes, 44)
                flags = [
                    above_ma(closes[idx], ma_series[idx]) if ma_series[idx] is not None else False
                    for idx in range(len(closes))
                ]
                pct_series = [
                    round(pct_vs_ma(closes[idx], ma_series[idx]), 2) if ma_series[idx] is not None else 0.0
                    for idx in range(len(closes))
                ]
                close = closes[-1]
                ma44 = ma_series[-1]
                pct = pct_vs_ma(close, ma44)
                constituents.append(
                    SectorConstituent(
                        symbol=stock.symbol,
                        company=stock.company,
                        close=round(close, 2),
                        ma44=round(ma44, 2) if ma44 is not None else None,
                        pct_vs_ma44=round(pct, 2),
                        above_ma44=above_ma(close, ma44),
                        sparkline=pct_series[-20:],
                    )
                )
                above_matrix.append(flags)
                if len(dates) > len(label_source):
                    label_source = dates

            weekly_raw = weekly_breadth_series(above_matrix, week_days=5, weeks=8)
            labels = self._week_labels_from_dates(label_source, weeks=8, week_days=5) if label_source else week_labels
            weekly = [
                WeeklyBreadthPoint(label=labels[idx], pct=cell["pct"], avg_above=cell["avg_above"])
                for idx, cell in enumerate(weekly_raw)
            ]
            weekly_pcts = [point.pct for point in weekly]
            avg8, momentum = rotation_coordinates(weekly_pcts)
            above = sum(1 for item in constituents if item.above_ma44)
            avg_pct = (
                round(sum(item.pct_vs_ma44 for item in constituents) / len(constituents), 2) if constituents else 0.0
            )
            summary = SectorSummary(
                name=industry,
                total=len(constituents),
                above=above,
                breadth=round(breadth_pct([item.above_ma44 for item in constituents]), 2),
                avg_pct_vs_ma=avg_pct,
                avg8=avg8,
                momentum=momentum,
                rotation_x=avg8,
                rotation_y=momentum,
            )
            bundles[industry] = {
                "constituents": constituents,
                "weekly": weekly,
                "summary": summary,
            }
        return bundles

    @staticmethod
    def _default_week_labels(weeks: int = 8) -> list[str]:
        now = datetime.now()
        labels: list[str] = []
        for offset in range(weeks - 1, -1, -1):
            # Approximate week labels without requiring bar history.
            labels.append(now.strftime("%b") if offset == 0 else f"W-{offset}")
        return labels

    @staticmethod
    def _week_labels_from_dates(dates: list[str], *, weeks: int, week_days: int) -> list[str]:
        needed = weeks * week_days
        start = max(0, len(dates) - needed)
        labels: list[str] = []
        for week_index in range(weeks):
            end_idx = min(len(dates) - 1, start + (week_index + 1) * week_days - 1)
            day = dates[end_idx]
            try:
                parsed = datetime.strptime(day, "%Y-%m-%d")
                labels.append(f"{parsed.strftime('%b')} {parsed.day}")
            except ValueError:
                labels.append(day[5:])
        return labels
