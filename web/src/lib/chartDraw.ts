import type { CandlesResponse } from "@/lib/types";
import { dayKey, fmtDateLabel } from "@/lib/format";

export type ChartHover = {
  idx: number;
  my: number | null;
};

type DrawOpts = {
  canvas: HTMLCanvasElement;
  data: CandlesResponse;
  hover: ChartHover | null;
  showBb: boolean;
  showRsi: boolean;
};

export function drawPriceTimeline({
  canvas,
  data,
  hover,
  showBb,
  showRsi,
}: DrawOpts) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const dpr = window.devicePixelRatio || 1;
  const W = parent.clientWidth;
  const H = parent.clientHeight;
  if (!W || !H) return;

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const cds = data.bars;
  const ma = data.ma44;
  const n = cds.length;
  if (!n) return;

  const padL = 10;
  const padR = 58;
  const padT = 12;
  const padB = 22;
  const gap = 8;
  const plotW = W - padL - padR;
  const rsiOn = !!(showRsi && data.rsi);
  const avail = H - padT - padB;
  const volH = Math.max(rsiOn ? 26 : 34, avail * (rsiOn ? 0.12 : 0.18));
  const rsiH = rsiOn ? Math.max(56, avail * 0.3) : 0;
  const priceH = avail - volH - rsiH - gap * (rsiOn ? 2 : 1);
  const priceTop = padT;
  const volTop = priceTop + priceH + gap;
  const cw = plotW / n;
  const bandBottom = volTop + volH;
  const rsiTop = bandBottom + gap;
  const rsiBottom = rsiTop + rsiH;

  let hi = -Infinity;
  let lo = Infinity;
  cds.forEach((c) => {
    if (c.high > hi) hi = c.high;
    if (c.low < lo) lo = c.low;
  });
  ma.forEach((v) => {
    if (v != null) {
      if (v > hi) hi = v;
      if (v < lo) lo = v;
    }
  });
  const bb = showBb ? data.bb : null;
  if (bb) {
    bb.up.forEach((v) => {
      if (v != null && v > hi) hi = v;
    });
    bb.lo.forEach((v) => {
      if (v != null && v < lo) lo = v;
    });
  }
  const pad = (hi - lo) * 0.08 || 1;
  hi += pad;
  lo -= pad;

  const py = (v: number) => priceTop + (1 - (v - lo) / (hi - lo)) * priceH;
  const cx = (i: number) => padL + cw * i + cw / 2;

  ctx.font = `10px ${getComputedStyle(document.body).fontFamily}`;

  // highlight bands — daily only
  if (data.timeframe.toUpperCase() === "D" && data.highlights?.length) {
    const hmap: Record<string, { color: string }> = {};
    data.highlights.forEach((h) => {
      const key = dayKey(h.date || h.ts || "");
      if (key) hmap[key] = { color: h.color || "#3C2CDA" };
    });
    cds.forEach((c, i) => {
      const h = hmap[dayKey(c.date)];
      if (!h) return;
      ctx.fillStyle = `${h.color}20`;
      ctx.fillRect(cx(i) - cw / 2, priceTop, cw, bandBottom - priceTop);
      ctx.fillStyle = h.color;
      ctx.fillRect(cx(i) - cw * 0.35, priceTop, cw * 0.7, 3);
    });
  }

  // price grid
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    const y = py(v);
    ctx.strokeStyle = "#EEF0F3";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillStyle = "#9BA3AD";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(v.toFixed(0), padL + plotW + 6, y);
  }

  // x labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#9BA3AD";
  for (let i = 0; i <= 6; i++) {
    const idx = Math.round(((n - 1) * i) / 6);
    ctx.fillText(fmtDateLabel(cds[idx].date), cx(idx), H - padB + 5);
  }

  const bw = Math.max(2, cw * 0.6);
  const hv = hover?.idx ?? null;

  cds.forEach((c, i) => {
    const up = c.close >= c.open;
    const col = up ? "#12A053" : "#DC3545";
    const x = cx(i);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, py(c.high));
    ctx.lineTo(x, py(c.low));
    ctx.stroke();
    const yo = py(c.open);
    const yc = py(c.close);
    ctx.fillStyle = col;
    ctx.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yc - yo)));
    if (i === hv) {
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        x - bw / 2 - 1.5,
        Math.min(yo, yc) - 1.5,
        bw + 3,
        Math.max(1, Math.abs(yc - yo)) + 3,
      );
    }
  });

  // MA
  ctx.beginPath();
  let started = false;
  ma.forEach((v, i) => {
    if (v == null) return;
    const x = cx(i);
    const y = py(v);
    if (started) ctx.lineTo(x, y);
    else {
      ctx.moveTo(x, y);
      started = true;
    }
  });
  ctx.strokeStyle = "#EA9D00";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Bollinger
  if (bb) {
    ctx.beginPath();
    let sU = false;
    bb.up.forEach((v, i) => {
      if (v == null) return;
      const x = cx(i);
      const y = py(v);
      if (sU) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        sU = true;
      }
    });
    for (let i = bb.lo.length - 1; i >= 0; i--) {
      const v = bb.lo[i];
      if (v == null) continue;
      ctx.lineTo(cx(i), py(v));
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(60,44,218,0.07)";
    ctx.fill();

    const bline = (arr: (number | null)[], dash: number[]) => {
      ctx.beginPath();
      let stt = false;
      arr.forEach((v, i) => {
        if (v == null) return;
        const x = cx(i);
        const y = py(v);
        if (stt) ctx.lineTo(x, y);
        else {
          ctx.moveTo(x, y);
          stt = true;
        }
      });
      ctx.strokeStyle = "rgba(60,44,218,0.55)";
      ctx.lineWidth = 1;
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    bline(bb.up, [4, 3]);
    bline(bb.lo, [4, 3]);
    ctx.globalAlpha = 0.8;
    bline(bb.mid, [1, 3]);
    ctx.globalAlpha = 1;
  }

  // volume
  let mv = 0;
  cds.forEach((c) => {
    if (c.volume > mv) mv = c.volume;
  });
  ctx.fillStyle = "#9BA3AD";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Vol", padL, volTop - 1);
  cds.forEach((c, i) => {
    const up = c.close >= c.open;
    const bh = mv ? (c.volume / mv) * (volH - 6) : 0;
    ctx.fillStyle = up ? "rgba(18,160,83,0.4)" : "rgba(220,53,69,0.4)";
    ctx.fillRect(cx(i) - bw / 2, bandBottom - bh, bw, bh);
  });

  // RSI
  if (rsiOn && data.rsi) {
    const rsi = data.rsi;
    const ry = (v: number) => rsiTop + (1 - v / 100) * rsiH;
    const ff = `10px ${getComputedStyle(document.body).fontFamily}`;
    ctx.fillStyle = "rgba(60,44,218,0.05)";
    ctx.fillRect(padL, ry(70), plotW, ry(30) - ry(70));
    [70, 50, 30].forEach((v) => {
      ctx.strokeStyle = v === 50 ? "#EEF0F3" : "#D9DCF7";
      ctx.setLineDash(v === 50 ? [] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, ry(v));
      ctx.lineTo(padL + plotW, ry(v));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#9BA3AD";
      ctx.font = ff;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(v), padL + plotW + 6, ry(v));
    });
    ctx.beginPath();
    let sr = false;
    rsi.forEach((v, i) => {
      if (v == null) return;
      const x = cx(i);
      const y = ry(v);
      if (sr) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        sr = true;
      }
    });
    ctx.strokeStyle = "#3C2CDA";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.fillStyle = "#9BA3AD";
    ctx.font = ff;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("RSI 14", padL, rsiTop - 1);
    let last: number | null = null;
    for (let i = rsi.length - 1; i >= 0; i--) {
      if (rsi[i] != null) {
        last = rsi[i];
        break;
      }
    }
    if (last != null) {
      ctx.fillStyle = "#3C2CDA";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.font = `700 10px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillText(last.toFixed(0), padL + plotW, rsiTop - 1);
    }
  }

  // comment markers (daily)
  if (data.timeframe.toUpperCase() === "D" && data.comments?.length) {
    data.comments.forEach((_, k) => {
      const idx = n - 1 - (k * 3 + 1);
      if (idx < 0) return;
      const x = cx(idx);
      ctx.fillStyle = "#6B7280";
      ctx.beginPath();
      ctx.moveTo(x, priceTop + 9);
      ctx.lineTo(x - 4, priceTop + 2);
      ctx.lineTo(x + 4, priceTop + 2);
      ctx.closePath();
      ctx.fill();
    });
  }

  // crosshair
  if (hv != null && cds[hv]) {
    const x = cx(hv);
    ctx.strokeStyle = "#CDD2D8";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, priceTop);
    ctx.lineTo(x, rsiOn ? rsiBottom : bandBottom);
    ctx.stroke();
    const my = hover?.my;
    if (my != null && my >= priceTop && my <= priceTop + priceH) {
      ctx.beginPath();
      ctx.moveTo(padL, my);
      ctx.lineTo(padL + plotW, my);
      ctx.stroke();
      ctx.setLineDash([]);
      const pv = lo + (1 - (my - priceTop) / priceH) * (hi - lo);
      ctx.fillStyle = "#374151";
      ctx.fillRect(padL + plotW, my - 9, padR - 4, 18);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pv.toFixed(1), padL + plotW + (padR - 4) / 2, my);
    }
    ctx.setLineDash([]);
  }

  return { padL, cw, n, priceTop, priceH };
}

export function hoverIndexFromEvent(
  canvas: HTMLCanvasElement,
  clientX: number,
  n: number,
): number | null {
  if (!n) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const padL = 10;
  const padR = 58;
  const plotW = rect.width - padL - padR;
  const cw = plotW / n;
  const idx = Math.floor((x - padL) / cw);
  if (idx < 0 || idx >= n) return null;
  return idx;
}
