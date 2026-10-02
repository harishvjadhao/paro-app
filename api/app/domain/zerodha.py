"""Zerodha equity charge schedule (NSE). Rates are config constants — they change."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

Segment = Literal["Delivery", "Intraday"]

# Config constants (expose via Settings/Admin later).
NSE_TXN_RATE = 0.0000297
SEBI_RATE = 0.000001
GST_RATE = 0.18
DELIVERY_STT_RATE = 0.001
DELIVERY_STAMP_RATE = 0.00015
DELIVERY_DP_CHARGE = 15.34
INTRADAY_BROKERAGE_RATE = 0.0003
INTRADAY_BROKERAGE_CAP = 20.0
INTRADAY_STT_RATE = 0.00025
INTRADAY_STAMP_RATE = 0.00003


@dataclass(frozen=True)
class ChargeBreakdown:
    buy_val: float
    sell_val: float
    turnover: float
    brokerage: float
    stt: float
    txn: float
    sebi: float
    stamp: float
    gst: float
    dp: float
    total: float
    gross: float
    net: float

    def as_dict(self) -> dict[str, float]:
        return asdict(self)


def _zero(*, buy_val: float = 0.0, sell_val: float = 0.0) -> ChargeBreakdown:
    turnover = buy_val + sell_val
    return ChargeBreakdown(
        buy_val=buy_val,
        sell_val=sell_val,
        turnover=turnover,
        brokerage=0.0,
        stt=0.0,
        txn=0.0,
        sebi=0.0,
        stamp=0.0,
        gst=0.0,
        dp=0.0,
        total=0.0,
        gross=0.0,
        net=0.0,
    )


def zerodha_charges(
    segment: Segment,
    qty: float,
    buy: float,
    sell: float | None,
) -> ChargeBreakdown:
    """Compute equity charges for a closed round-trip.

    Open trades (sell is None) return zero charges; callers compute unrealized P&L separately.
    """
    quantity = float(qty or 0)
    buy_price = float(buy or 0)
    if quantity <= 0 or buy_price <= 0 or sell is None:
        buy_val = buy_price * max(quantity, 0.0)
        return _zero(buy_val=buy_val)

    sell_price = float(sell)
    buy_val = buy_price * quantity
    sell_val = sell_price * quantity
    turnover = buy_val + sell_val
    txn = turnover * NSE_TXN_RATE
    sebi = turnover * SEBI_RATE

    if segment == "Intraday":
        brokerage = min(INTRADAY_BROKERAGE_CAP, buy_val * INTRADAY_BROKERAGE_RATE) + min(
            INTRADAY_BROKERAGE_CAP, sell_val * INTRADAY_BROKERAGE_RATE
        )
        stt = sell_val * INTRADAY_STT_RATE
        stamp = buy_val * INTRADAY_STAMP_RATE
        dp = 0.0
    else:
        brokerage = 0.0
        stt = turnover * DELIVERY_STT_RATE
        stamp = buy_val * DELIVERY_STAMP_RATE
        dp = DELIVERY_DP_CHARGE

    gst = (brokerage + txn + sebi) * GST_RATE
    total = brokerage + stt + txn + sebi + stamp + gst + dp
    gross = (sell_price - buy_price) * quantity
    net = gross - total
    return ChargeBreakdown(
        buy_val=buy_val,
        sell_val=sell_val,
        turnover=turnover,
        brokerage=brokerage,
        stt=stt,
        txn=txn,
        sebi=sebi,
        stamp=stamp,
        gst=gst,
        dp=dp,
        total=total,
        gross=gross,
        net=net,
    )


def unrealized_pnl(qty: float, buy: float, last_close: float | None) -> float | None:
    if last_close is None or qty <= 0:
        return None
    return (float(last_close) - float(buy)) * float(qty)
