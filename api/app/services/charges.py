"""Zerodha equity charge calculator (config constants)."""

from __future__ import annotations

from dataclasses import dataclass


# Rates are config constants (they change over time).
NSE_TXN_RATE = 0.0000297
SEBI_RATE = 0.000001
GST_RATE = 0.18
DELIVERY_STT_RATE = 0.001
DELIVERY_STAMP_RATE = 0.00015
DELIVERY_DP = 15.34
INTRADAY_BROKERAGE_RATE = 0.0003
INTRADAY_BROKERAGE_CAP = 20.0
INTRADAY_STT_RATE = 0.00025
INTRADAY_STAMP_RATE = 0.00003


@dataclass(frozen=True)
class ChargeBreakdown:
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
    unrealized: float | None = None


def zerodha_charges(
    *,
    segment: str,
    qty: int,
    buy: float,
    sell: float | None,
    last_close: float | None = None,
) -> ChargeBreakdown:
    """segment: Delivery | Intraday. Open trade (sell is None): charges 0, unrealized P&L."""
    buy_val = buy * qty
    if sell is None:
        unrealized = None if last_close is None else (last_close - buy) * qty
        return ChargeBreakdown(
            brokerage=0,
            stt=0,
            txn=0,
            sebi=0,
            stamp=0,
            gst=0,
            dp=0,
            total=0,
            gross=0,
            net=0,
            unrealized=unrealized,
        )

    sell_val = sell * qty
    turnover = buy_val + sell_val
    txn = turnover * NSE_TXN_RATE
    sebi = turnover * SEBI_RATE
    seg = segment.strip().lower()

    if seg == "delivery":
        brokerage = 0.0
        stt = (buy_val + sell_val) * DELIVERY_STT_RATE
        stamp = buy_val * DELIVERY_STAMP_RATE
        dp = DELIVERY_DP
    elif seg == "intraday":
        brokerage = min(INTRADAY_BROKERAGE_CAP, buy_val * INTRADAY_BROKERAGE_RATE) + min(
            INTRADAY_BROKERAGE_CAP, sell_val * INTRADAY_BROKERAGE_RATE
        )
        stt = sell_val * INTRADAY_STT_RATE
        stamp = buy_val * INTRADAY_STAMP_RATE
        dp = 0.0
    else:
        raise ValueError(f"unknown segment: {segment}")

    gst = (brokerage + txn + sebi) * GST_RATE
    total = brokerage + stt + txn + sebi + stamp + gst + dp
    gross = (sell - buy) * qty
    net = gross - total
    return ChargeBreakdown(
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
        unrealized=None,
    )
