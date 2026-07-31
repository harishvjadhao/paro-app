import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageShell,
  SECTOR_PALETTE,
  StatCard,
} from "@/components/PageShell";
import { fmtPct, fmtPrice, fmtWeekLabel } from "@/lib/format";
import { extractSymbols, renderMarkdown } from "@/lib/markdown";
import {
  fetchRotation,
  fetchSector,
  fetchSectors,
  fetchWeeklyTrends,
  isNotFound,
  streamSectorChat,
} from "@/lib/marketsApi";
import { usePrefs } from "@/store/prefs";
import type { SectorConstituent } from "@/lib/types";

type SortKey = "symbol" | "close" | "ma44" | "pct";

type ChatMsg = {
  id: string;
  role: "user" | "ai";
  text: string;
};

type Pin = {
  id: string;
  text: string;
  sector: string;
  when: string;
};

const SUGGESTIONS = [
  "What is driving this sector?",
  "Which names are leading and lagging?",
  "How has breadth changed vs last week?",
  "What are the risks to this move?",
];

const PINS_KEY = "paro:sector-pins";

function loadPins(): Pin[] {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    return raw ? (JSON.parse(raw) as Pin[]) : [];
  } catch {
    return [];
  }
}

function savePins(pins: Pin[]) {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  } catch {
    /* ignore */
  }
}

function sparkPoints(pct: number): string {
  const slope = Math.max(-1, Math.min(1, pct / 8));
  const pts = [0, 1, 2, 3, 4].map((i) => {
    const x = 4 + i * 12;
    const y = 11 - slope * (i - 2) * 3.5 - Math.sin(i) * 1.2;
    return `${x},${y}`;
  });
  return pts.join(" ");
}

function sortRows(
  rows: SectorConstituent[],
  key: SortKey,
  dir: 1 | -1,
): SectorConstituent[] {
  return [...rows].sort((a, b) => {
    const av =
      key === "symbol"
        ? a.symbol
        : key === "close"
          ? a.close
          : key === "ma44"
            ? a.ma44
            : a.pct_vs_ma;
    const bv =
      key === "symbol"
        ? b.symbol
        : key === "close"
          ? b.close
          : key === "ma44"
            ? b.ma44
            : b.pct_vs_ma;
    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv) * dir;
    }
    return ((av as number) - (bv as number)) * dir;
  });
}

export function SectorPage() {
  const navigate = useNavigate();
  const setSelected = usePrefs((s) => s.setSelected);
  const [sectorName, setSectorName] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("pct");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [pins, setPins] = useState<Pin[]>(() => loadPins());
  const [pinHint, setPinHint] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const rotRef = useRef<HTMLCanvasElement | null>(null);
  const cmpRef = useRef<HTMLCanvasElement | null>(null);
  const rotDots = useRef<Array<{ name: string; x: number; y: number }>>([]);
  const lastQ = useRef("");

  const sectorsQ = useQuery({ queryKey: ["sectors"], queryFn: fetchSectors });
  const trendsQ = useQuery({
    queryKey: ["trends-weekly"],
    queryFn: fetchWeeklyTrends,
  });
  const rotationQ = useQuery({
    queryKey: ["sectors-rotation"],
    queryFn: fetchRotation,
  });

  const names = useMemo(
    () => (sectorsQ.data || []).map((s) => s.industry),
    [sectorsQ.data],
  );

  useEffect(() => {
    if (!names.length) return;
    if (!sectorName || !names.includes(sectorName)) {
      setSectorName(names[0]);
    }
  }, [names, sectorName]);

  const sectorQ = useQuery({
    queryKey: ["sector", sectorName],
    queryFn: () => fetchSector(sectorName!),
    enabled: !!sectorName,
  });

  const sector = sectorQ.data;
  const weekRow = trendsQ.data?.sectors.find((s) => s.name === sectorName);

  const rows = useMemo(() => {
    if (!sector) return [];
    return sortRows(sector.constituents, sortKey, sortDir);
  }, [sector, sortKey, sortDir]);

  const avgPct = useMemo(() => {
    if (!sector?.constituents.length) return 0;
    const sum = sector.constituents.reduce((a, c) => a + c.pct_vs_ma, 0);
    return sum / sector.constituents.length;
  }, [sector]);

  const leader = sector?.leaders?.[0] || null;
  const laggard = useMemo(() => {
    if (!sector?.constituents.length) return null;
    return [...sector.constituents].sort(
      (a, b) => a.pct_vs_ma - b.pct_vs_ma,
    )[0];
  }, [sector]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "symbol" ? 1 : -1);
    }
  };

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : "";

  // Rotation canvas
  useEffect(() => {
    const cv = rotRef.current;
    const data = rotationQ.data;
    if (!cv || !data?.length) return;
    const paint = () => {
      const parent = cv.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const pad = 28;
      const px = (x: number) => pad + (x / 100) * (w - pad * 2);
      const my = Math.max(8, ...data.map((d) => Math.abs(d.y)));
      const py = (y: number) =>
        h / 2 - (y / my) * ((h - pad * 2) / 2);
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--gray-200")
        .trim() || "#e2e6ea";
      ctx.beginPath();
      ctx.moveTo(pad, h / 2);
      ctx.lineTo(w - pad, h / 2);
      ctx.moveTo(px(50), pad);
      ctx.lineTo(px(50), h - pad);
      ctx.stroke();
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--gray-400")
        .trim() || "#9ba3ad";
      ctx.font = "10px Manrope, sans-serif";
      ctx.fillText("Breadth →", w - pad - 52, h / 2 - 6);
      ctx.fillText("Momentum ↑", px(50) + 6, pad + 10);
      rotDots.current = [];
      data.forEach((d) => {
        const x = px(Math.max(0, Math.min(100, d.x)));
        const y = py(Math.max(-my, Math.min(my, d.y)));
        const active = d.sector === sectorName;
        ctx.beginPath();
        ctx.arc(x, y, active ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = d.y >= 0 ? "#12A053" : "#DC3545";
        ctx.globalAlpha = active ? 1 : 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (active) {
          ctx.strokeStyle =
            getComputedStyle(document.documentElement)
              .getPropertyValue("--accent")
              .trim() || "#3C2CDA";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.fillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue("--gray-700")
          .trim() || "#374151";
        ctx.font = active
          ? "bold 11px Manrope, sans-serif"
          : "10px Manrope, sans-serif";
        ctx.fillText(d.sector.slice(0, 14), x + 8, y + 3);
        rotDots.current.push({ name: d.sector, x, y });
      });
    };
    paint();
    const ro = new ResizeObserver(paint);
    if (cv.parentElement) ro.observe(cv.parentElement);
    return () => ro.disconnect();
  }, [rotationQ.data, sectorName]);

  // Compare canvas
  useEffect(() => {
    const cv = cmpRef.current;
    const wb = trendsQ.data;
    if (!cv || !wb?.sectors.length) return;
    const paint = () => {
      const parent = cv.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const pad = 16;
      const n = Math.max(1, wb.weeks.length - 1);
      const x = (i: number) => pad + (i / n) * (w - pad * 2);
      const y = (pct: number) =>
        h - pad - (pct / 100) * (h - pad * 2);
      ctx.strokeStyle =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--gray-100")
          .trim() || "#f0f2f5";
      [25, 50, 75].forEach((p) => {
        ctx.beginPath();
        ctx.moveTo(pad, y(p));
        ctx.lineTo(w - pad, y(p));
        ctx.stroke();
      });
      wb.sectors.forEach((s, si) => {
        const col = SECTOR_PALETTE[si % SECTOR_PALETTE.length];
        const active = s.name === sectorName;
        ctx.beginPath();
        s.cells.forEach((c, i) => {
          if (i === 0) ctx.moveTo(x(i), y(c.pct));
          else ctx.lineTo(x(i), y(c.pct));
        });
        ctx.strokeStyle = col;
        ctx.globalAlpha = active ? 1 : 0.45;
        ctx.lineWidth = active ? 2.5 : 1.4;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    };
    paint();
    const ro = new ResizeObserver(paint);
    if (cv.parentElement) ro.observe(cv.parentElement);
    return () => ro.disconnect();
  }, [trendsQ.data, sectorName]);

  const onRotationClick = (e: React.MouseEvent) => {
    const cv = rotRef.current;
    if (!cv || !rotDots.current.length) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let bestName: string | null = null;
    let bd = 1e9;
    for (const d of rotDots.current) {
      const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
      if (dd < bd) {
        bd = dd;
        bestName = d.name;
      }
    }
    if (bestName && bd < 320) setSectorName(bestName);
  };

  const openStock = (sym: string) => {
    setSelected(sym);
    navigate("/");
  };

  const sendChat = async (q: string) => {
    const question = q.trim();
    if (!question || !sectorName || streaming) return;
    lastQ.current = question;
    setAiError(null);
    setAiUnavailable(false);
    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: question,
    };
    const aiId = `a-${Date.now()}`;
    setChat((c) => [...c, userMsg, { id: aiId, role: "ai", text: "" }]);
    setInput("");
    setStreaming(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamSectorChat(sectorName, question, {
        signal: ac.signal,
        onToken: (token) => {
          setChat((c) =>
            c.map((m) =>
              m.id === aiId ? { ...m, text: m.text + token } : m,
            ),
          );
        },
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (isNotFound(err)) {
        setAiUnavailable(true);
        setAiError(
          "Sector AI is not available yet. The endpoint will light up when Phase 5 lands.",
        );
        setChat((c) => c.filter((m) => m.id !== aiId));
      } else {
        setAiError(
          err instanceof Error ? err.message : "Failed to reach sector AI",
        );
        setChat((c) => c.filter((m) => m.id !== aiId));
      }
    } finally {
      setStreaming(false);
    }
  };

  const pinSelection = () => {
    const sel = window.getSelection()?.toString().trim();
    if (!sel) {
      setPinHint(true);
      setTimeout(() => setPinHint(false), 2500);
      return;
    }
    const pin: Pin = {
      id: `p-${Date.now()}`,
      text: sel,
      sector: sectorName || "",
      when: new Date().toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setPins((p) => {
      const next = [pin, ...p];
      savePins(next);
      return next;
    });
  };

  const allowedSyms = useMemo(
    () => new Set((sector?.constituents || []).map((c) => c.symbol)),
    [sector],
  );

  if (sectorsQ.isLoading) {
    return (
      <PageShell title="Sector Analysis" subtitle="Loading sectors…">
        <LoadingBlock rows={6} />
      </PageShell>
    );
  }

  if (sectorsQ.isError) {
    return (
      <PageShell title="Sector Analysis">
        <ErrorBlock
          message="Could not load sectors."
          onRetry={() => void sectorsQ.refetch()}
        />
      </PageShell>
    );
  }

  if (!names.length) {
    return (
      <PageShell
        title="Sector Analysis"
        subtitle="Breadth, momentum, and constituents for a single sector."
      >
        <EmptyState
          title="No sectors yet"
          copy="Upload a Nifty 200 stock list in Admin and sync prices to populate sector breadth."
        />
      </PageShell>
    );
  }

  const below = (sector?.total || 0) - (sector?.above || 0);
  const aboveW =
    sector && sector.total
      ? `${(sector.above / sector.total) * 100}%`
      : "0%";
  const belowW =
    sector && sector.total ? `${(below / sector.total) * 100}%` : "0%";

  return (
    <PageShell
      title="Sector Analysis"
      subtitle="Breadth, momentum, and constituents for a single sector of the active universe."
    >
      <div className="chip-row mb-14">
        {names.map((nm) => (
          <button
            key={nm}
            type="button"
            className={`chip-tab${nm === sectorName ? " is-on" : ""}`}
            onClick={() => setSectorName(nm)}
          >
            {nm}
          </button>
        ))}
      </div>

      {sectorQ.isLoading ? (
        <LoadingBlock rows={4} />
      ) : sectorQ.isError ? (
        <ErrorBlock
          message="Could not load this sector."
          onRetry={() => void sectorQ.refetch()}
        />
      ) : sector ? (
        <>
          <div className="stat-grid-5 mb-12">
            <StatCard label="Stocks" value={sector.total} />
            <StatCard
              label="% Above 44 MA"
              value={`${Math.round(sector.breadth)}%`}
              valueClass="pos"
              sub={`${sector.above} of ${sector.total} above`}
            />
            <StatCard
              label="Avg vs 44 MA"
              value={fmtPct(avgPct)}
              valueClass={avgPct >= 0 ? "pos" : "neg"}
            />
            <StatCard
              label="Advancers / Decliners"
              value={
                <>
                  {sector.above}{" "}
                  <span className="pos" style={{ fontSize: 16 }}>
                    ▲
                  </span>{" "}
                  <span className="muted">/</span> {below}{" "}
                  <span className="neg" style={{ fontSize: 16 }}>
                    ▼
                  </span>
                </>
              }
            />
            <StatCard
              label="8-wk Avg Breadth"
              value={weekRow ? `${weekRow.avg8}%` : "—"}
              sub={
                weekRow && weekRow.cells.length >= 2
                  ? (() => {
                      const last = weekRow.cells[weekRow.cells.length - 1].pct;
                      const prior =
                        weekRow.cells[weekRow.cells.length - 2].pct;
                      const d = last - prior;
                      return (
                        <span className={d >= 0 ? "pos" : "neg"}>
                          <Icon
                            name={d >= 0 ? "trending-up" : "trending-down"}
                            size={13}
                          />{" "}
                          {d >= 0 ? "+" : ""}
                          {d.toFixed(1)} pts · vs prior week
                        </span>
                      );
                    })()
                  : undefined
              }
            />
          </div>

          <div className="sector-main-grid mb-12">
            <div className="card">
              <div className="card-title mb-6">
                Constituents · {sector.industry}
              </div>
              <div className="const-head">
                <button
                  type="button"
                  className="th-btn"
                  onClick={() => toggleSort("symbol")}
                >
                  Symbol{arrow("symbol")}
                </button>
                <span className="th">Company</span>
                <span className="th center">Trend</span>
                <button
                  type="button"
                  className="th-btn right"
                  onClick={() => toggleSort("close")}
                >
                  Close{arrow("close")}
                </button>
                <button
                  type="button"
                  className="th-btn right"
                  onClick={() => toggleSort("ma44")}
                >
                  44 MA{arrow("ma44")}
                </button>
                <button
                  type="button"
                  className="th-btn right"
                  onClick={() => toggleSort("pct")}
                >
                  % vs MA{arrow("pct")}
                </button>
                <span className="th right">Signal</span>
              </div>
              <div className="const-body">
                {rows.map((r) => (
                  <button
                    key={r.symbol}
                    type="button"
                    className="const-row"
                    onClick={() => openStock(r.symbol)}
                  >
                    <span className="fw7">{r.symbol}</span>
                    <span className="ellipsis muted">{r.company}</span>
                    <span className="center">
                      <svg width="56" height="22" viewBox="0 0 56 22">
                        <polyline
                          points={sparkPoints(r.pct_vs_ma)}
                          fill="none"
                          stroke={r.above ? "#12A053" : "#DC3545"}
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span className="right fw6">{fmtPrice(r.close)}</span>
                    <span className="right fw6 honey">{fmtPrice(r.ma44)}</span>
                    <span
                      className={`right fw7 ${r.pct_vs_ma >= 0 ? "pos" : "neg"}`}
                    >
                      {fmtPct(r.pct_vs_ma)}
                    </span>
                    <span className="right">
                      <span
                        className={`signal-badge ${r.above ? "above" : "below"}`}
                      >
                        {r.above ? "Above" : "Below"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sector-side">
              <div className="card">
                <div className="card-kicker mb">Leaders & laggards</div>
                {leader ? (
                  <div className="leader-row above">
                    <span className="fw7">
                      <Icon name="trending-up" size={16} /> {leader.symbol}
                    </span>
                    <span className="pos">{fmtPct(leader.pct_vs_ma)}</span>
                  </div>
                ) : null}
                {laggard ? (
                  <div className="leader-row below">
                    <span className="fw7">
                      <Icon name="trending-down" size={16} /> {laggard.symbol}
                    </span>
                    <span className="neg">{fmtPct(laggard.pct_vs_ma)}</span>
                  </div>
                ) : null}
              </div>

              <div className="card">
                <div className="card-kicker mb">
                  Weekly breadth · % above 44 MA
                </div>
                <div className="breadth-bars">
                  {(weekRow?.cells || []).map((c) => (
                    <div key={c.week} className="breadth-bar-col">
                      <span className="bar-pct">{Math.round(c.pct)}</span>
                      <div
                        className="bar-fill"
                        style={{
                          height: `${Math.max(4, c.pct)}%`,
                          background:
                            c.pct >= 50 ? "var(--success)" : "var(--danger)",
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="breadth-bar-labels">
                  {(weekRow?.cells || []).map((c) => (
                    <span key={c.week}>{fmtWeekLabel(c.week)}</span>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-kicker mb">Above / below 44 MA</div>
                <div className="split-bar">
                  <div
                    style={{ width: aboveW, background: "var(--success)" }}
                  />
                  <div
                    style={{ width: belowW, background: "var(--danger)" }}
                  />
                </div>
                <div className="split-labels">
                  <span className="pos fw7">{sector.above} above</span>
                  <span className="neg fw7">{below} below</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sector-rot-grid mb-12">
            <div className="card">
              <div className="card-title">Sector Rotation</div>
              <div className="card-hint">
                8-week avg breadth (x) vs latest momentum (y). Click a sector to
                select it.
              </div>
              <div
                className="canvas-box h240"
                onClick={onRotationClick}
                role="presentation"
              >
                <canvas ref={rotRef} />
              </div>
            </div>
            <div className="card">
              <div className="card-title">Compare Sectors</div>
              <div className="card-hint">
                Weekly % above 44 MA, all sectors. Selected sector bold.
              </div>
              <div className="canvas-box h180">
                <canvas ref={cmpRef} />
              </div>
              <div className="cmp-legend">
                {(trendsQ.data?.sectors || []).map((s, i) => (
                  <button
                    key={s.name}
                    type="button"
                    className={`legend-item${s.name === sectorName ? " is-on" : ""}`}
                    onClick={() => setSectorName(s.name)}
                  >
                    <span
                      className="legend-swatch"
                      style={{
                        background: SECTOR_PALETTE[i % SECTOR_PALETTE.length],
                      }}
                    />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sector-ai-grid">
            <div className="card ai-panel">
              <div className="ai-head">
                <Icon name="sparkles" size={17} className="accent" />
                <span className="card-title">Ask AI · {sector.industry}</span>
                <div className="flex-1" />
                {chat.length ? (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => {
                      setChat([]);
                      setAiError(null);
                    }}
                  >
                    <Icon name="eraser" size={13} /> Clear
                  </button>
                ) : null}
              </div>
              <div className="card-hint mb-12">
                Select any text in a reply, then click Pin to save it as a
                result.
              </div>
              <div className="ai-messages">
                {!chat.length && !aiError ? (
                  <div className="ai-empty">
                    Ask about {sector.industry} breadth, leaders, or what&rsquo;s
                    driving the move.
                  </div>
                ) : null}
                {chat.map((m) => (
                  <div
                    key={m.id}
                    className={`ai-msg ${m.role === "user" ? "user" : "ai"}`}
                  >
                    <div className="ai-bubble">
                      {m.role === "user" ? (
                        m.text
                      ) : (
                        <>
                          <div className="md">{renderMarkdown(m.text)}</div>
                          {(() => {
                            const syms = extractSymbols(m.text, allowedSyms);
                            if (!syms.length) return null;
                            return (
                              <div className="sym-chips">
                                {syms.map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    className="sym-chip"
                                    onClick={() => openStock(s)}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                          {m.text ? (
                            <div className="ai-pin-row">
                              <button
                                type="button"
                                className="btn-ghost sm"
                                onClick={pinSelection}
                              >
                                <Icon name="pin" size={12} /> Pin selection
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {streaming ? (
                  <div className="ai-msg ai">
                    <div className="ai-bubble muted">
                      Analysing {sector.industry}…
                    </div>
                  </div>
                ) : null}
                {aiError ? (
                  <div className="ai-msg ai">
                    <div className="ai-bubble error">
                      {aiError}{" "}
                      {!aiUnavailable ? (
                        <button
                          type="button"
                          className="btn-text danger"
                          onClick={() => void sendChat(lastQ.current)}
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              {pinHint ? (
                <div className="pin-hint">
                  Select some text inside a reply first, then click Pin.
                </div>
              ) : null}
              {!chat.length ? (
                <div className="suggest-row">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="chip-tab"
                      onClick={() => void sendChat(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="ai-compose">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendChat(input);
                    }
                  }}
                  placeholder="Ask about this sector…"
                  rows={2}
                />
                {streaming ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => abortRef.current?.abort()}
                  >
                    <Icon name="square" size={13} /> Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!input.trim()}
                    onClick={() => void sendChat(input)}
                  >
                    Send
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <div className="ai-head mb-12">
                <Icon name="pin" size={16} className="accent" />
                <span className="card-title">Pinned results</span>
              </div>
              {!pins.length ? (
                <div className="dash-empty dashed">
                  No pins yet. Highlight text in an AI reply and pin it.
                </div>
              ) : (
                <ul className="pin-list">
                  {pins.map((p, idx) => (
                    <li key={p.id}>
                      <div className="pin-row">
                        <span className="pin-text">{p.text}</span>
                        <div className="pin-ops">
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={idx === 0}
                            onClick={() => {
                              setPins((arr) => {
                                if (idx === 0) return arr;
                                const next = [...arr];
                                [next[idx - 1], next[idx]] = [
                                  next[idx],
                                  next[idx - 1],
                                ];
                                savePins(next);
                                return next;
                              });
                            }}
                          >
                            <Icon name="chevron-up" size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={idx === pins.length - 1}
                            onClick={() => {
                              setPins((arr) => {
                                if (idx >= arr.length - 1) return arr;
                                const next = [...arr];
                                [next[idx + 1], next[idx]] = [
                                  next[idx],
                                  next[idx + 1],
                                ];
                                savePins(next);
                                return next;
                              });
                            }}
                          >
                            <Icon name="chevron-down" size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => {
                              setPins((arr) => {
                                const next = arr.filter((x) => x.id !== p.id);
                                savePins(next);
                                return next;
                              });
                            }}
                          >
                            <Icon name="x" size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="pin-meta">
                        {p.sector} · {p.when}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
