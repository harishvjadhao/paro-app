import { useEffect, useRef, useState } from "react";
import {
  drawPriceTimeline,
  hoverIndexFromEvent,
  type ChartHover,
} from "@/lib/chartDraw";
import { fmtDateLabel, fmtPrice } from "@/lib/format";
import type { CandlesResponse, Timeframe } from "@/lib/types";
import { usePrefs } from "@/store/prefs";

type Props = {
  data: CandlesResponse | undefined;
  isLoading: boolean;
};

const TF: Array<{ id: Timeframe; label: string }> = [
  { id: "D", label: "Daily" },
  { id: "W", label: "Weekly" },
  { id: "M", label: "Monthly" },
];

export function PriceTimeline({ data, isLoading }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeframe = usePrefs((s) => s.timeframe);
  const setTimeframe = usePrefs((s) => s.setTimeframe);
  const bollinger = usePrefs((s) => s.bollinger);
  const toggleBollinger = usePrefs((s) => s.toggleBollinger);
  const rsi = usePrefs((s) => s.rsi);
  const toggleRsi = usePrefs((s) => s.toggleRsi);
  const [hover, setHover] = useState<ChartHover | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !data) return;

    const paint = () => {
      drawPriceTimeline({
        canvas: cv,
        data,
        hover,
        showBb: bollinger,
        showRsi: rsi,
      });
    };
    paint();

    const ro = new ResizeObserver(paint);
    if (cv.parentElement) ro.observe(cv.parentElement);
    return () => ro.disconnect();
  }, [bollinger, data, hover, rsi]);

  const bars = data?.bars ?? [];
  const idx = hover?.idx ?? (bars.length ? bars.length - 1 : -1);
  const bar = idx >= 0 ? bars[idx] : null;
  const ma = idx >= 0 ? data?.ma44[idx] : null;

  const tfPill =
    timeframe === "W"
      ? "Weekly · 44 bars"
      : timeframe === "M"
        ? "Monthly · 44 bars"
        : "Daily · 44 bars";

  return (
    <section className="card timeline-card">
      <div className="timeline-toolbar">
        <span className="timeline-title">Price Timeline</span>
        <span className="pill accent">{tfPill}</span>
        <div className="flex-1" />
        <div className="seg">
          {TF.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`seg-btn${timeframe === t.id ? " is-on" : ""}`}
              onClick={() => {
                setTimeframe(t.id);
                setHover(null);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`pill-toggle${bollinger ? " is-on" : ""}`}
          onClick={toggleBollinger}
        >
          <span className="bb-swatch" />
          Bollinger
        </button>
        <button
          type="button"
          className={`pill-toggle${rsi ? " is-on" : ""}`}
          onClick={toggleRsi}
        >
          <span className="rsi-swatch" />
          RSI
        </button>
      </div>

      <div className="legend-row">
        <span>
          <i className="lg-ma" />
          44-period MA
        </span>
        <span>
          <i className="lg-bb" />
          Bollinger (20, 2)
        </span>
        <span>
          <i className="lg-rsi" />
          RSI (14)
        </span>
        <span>
          <i className="lg-hl" />
          Highlight
        </span>
      </div>

      <div className="stat-strip">
        <div>
          <div className="stat-k">Date</div>
          <div className="stat-v">
            {bar ? fmtDateLabel(bar.date) : "—"}
          </div>
        </div>
        <div>
          <div className="stat-k">Open</div>
          <div className="stat-v">{fmtPrice(bar?.open)}</div>
        </div>
        <div>
          <div className="stat-k">High</div>
          <div className="stat-v">{fmtPrice(bar?.high)}</div>
        </div>
        <div>
          <div className="stat-k">Low</div>
          <div className="stat-v">{fmtPrice(bar?.low)}</div>
        </div>
        <div>
          <div className="stat-k">Close</div>
          <div className="stat-v">{fmtPrice(bar?.close)}</div>
        </div>
        <div>
          <div className="stat-k">44 MA</div>
          <div className="stat-v honey">{fmtPrice(ma)}</div>
        </div>
      </div>

      <div className="chart-frame">
        {isLoading && <div className="skel chart-skel" />}
        <canvas
          ref={canvasRef}
          className="chart-canvas"
          onMouseMove={(e) => {
            const cv = canvasRef.current;
            if (!cv || !bars.length) return;
            const i = hoverIndexFromEvent(cv, e.clientX, bars.length);
            const rect = cv.getBoundingClientRect();
            setHover(
              i == null
                ? null
                : { idx: i, my: e.clientY - rect.top },
            );
          }}
          onMouseLeave={() => setHover(null)}
        />
      </div>

      {data?.highlights && data.highlights.length > 0 && timeframe === "D" && (
        <div className="chart-legend">
          {data.highlights.map((lg, i) => (
            <span key={i} className="hl-chip">
              <i style={{ background: lg.color || "var(--accent)" }} />
              {lg.label || "Highlight"}
              {lg.date || lg.ts
                ? ` · ${fmtDateLabel(lg.date || lg.ts || "")}`
                : ""}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
