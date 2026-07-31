/** Client-side Zerodha equity charge preview (mirrors api/services/charges.py). */

export type ChargeBreakdown = {
  brokerage: number;
  stt: number;
  txn: number;
  sebi: number;
  stamp: number;
  gst: number;
  dp: number;
  total: number;
  gross: number;
  net: number;
  unrealized: number | null;
};

const NSE_TXN_RATE = 0.0000297;
const SEBI_RATE = 0.000001;
const GST_RATE = 0.18;
const DELIVERY_STT_RATE = 0.001;
const DELIVERY_STAMP_RATE = 0.00015;
const DELIVERY_DP = 15.34;
const INTRADAY_BROKERAGE_RATE = 0.0003;
const INTRADAY_BROKERAGE_CAP = 20.0;
const INTRADAY_STT_RATE = 0.00025;
const INTRADAY_STAMP_RATE = 0.00003;

export function zerodhaCharges(opts: {
  segment: string;
  qty: number;
  buy: number;
  sell: number | null;
  lastClose?: number | null;
}): ChargeBreakdown {
  const { segment, qty, buy, sell, lastClose = null } = opts;
  const buyVal = buy * qty;
  if (sell == null) {
    const unrealized =
      lastClose == null ? null : (lastClose - buy) * qty;
    return {
      brokerage: 0,
      stt: 0,
      txn: 0,
      sebi: 0,
      stamp: 0,
      gst: 0,
      dp: 0,
      total: 0,
      gross: 0,
      net: 0,
      unrealized,
    };
  }
  const sellVal = sell * qty;
  const turnover = buyVal + sellVal;
  const txn = turnover * NSE_TXN_RATE;
  const sebi = turnover * SEBI_RATE;
  const seg = segment.trim().toLowerCase();
  let brokerage = 0;
  let stt = 0;
  let stamp = 0;
  let dp = 0;
  if (seg === "delivery") {
    brokerage = 0;
    stt = (buyVal + sellVal) * DELIVERY_STT_RATE;
    stamp = buyVal * DELIVERY_STAMP_RATE;
    dp = DELIVERY_DP;
  } else {
    brokerage =
      Math.min(INTRADAY_BROKERAGE_CAP, buyVal * INTRADAY_BROKERAGE_RATE) +
      Math.min(INTRADAY_BROKERAGE_CAP, sellVal * INTRADAY_BROKERAGE_RATE);
    stt = sellVal * INTRADAY_STT_RATE;
    stamp = buyVal * INTRADAY_STAMP_RATE;
    dp = 0;
  }
  const gst = (brokerage + txn + sebi) * GST_RATE;
  const total = brokerage + stt + txn + sebi + stamp + gst + dp;
  const gross = sellVal - buyVal;
  const net = gross - total;
  return {
    brokerage,
    stt,
    txn,
    sebi,
    stamp,
    gst,
    dp,
    total,
    gross,
    net,
    unrealized: null,
  };
}
