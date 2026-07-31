import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageShell,
} from "@/components/PageShell";
import { fmtPct } from "@/lib/format";
import { fetchWeeklyDrill, fetchWeeklyTrends } from "@/lib/marketsApi";

export function TrendsPage() {
  const trendsQ = useQuery({ queryKey: ["trends-weekly"], queryFn: fetchWeeklyTrends });
  const [drill, setDrill] = useState<{ sector: string; weekIndex: number } | null>(null);
  const drillQ = useQuery({
    queryKey: ["trends-drill", drill?.sector, drill?.weekIndex],
    queryFn: () => fetchWeeklyDrill(drill!.sector, drill!.weekIndex),
    enabled: !!drill,
  });

  const heat = useMemo(() => {
    const rows = trendsQ.data?.sectors ?? [];
    const vals = rows.flatMap((r) => r.cells.map((c) => c.pct));
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, 100);
    return { min, max };
  }, [trendsQ.data]);

  const colorFor = (pct: number) => {
    const t = (pct - heat.min) / Math.max(heat.max - heat.min, 1);
    const g = Math.round(40 + t * 140);
    const r = Math.round(200 - t * 120);
    return `rgba(${r},${g},90,0.35)`;
  };

  return (
    <PageShell
      title="Weekly Sector Trends"
      subtitle="8-week average share of stocks above their 44-day MA"
      maxWidth={1280}
    >
      {trendsQ.isLoading ? <LoadingBlock rows={6} /> : null}
      {trendsQ.isError ? <ErrorBlock message="Could not load weekly trends." /> : null}
      {trendsQ.data && trendsQ.data.sectors.length === 0 ? (
        <EmptyState title="No trend data yet" copy="Sync prices after seeding the universe." />
      ) : null}
      {trendsQ.data && trendsQ.data.sectors.length > 0 ? (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="data-table trends-matrix">
            <thead>
              <tr>
                <th>Sector</th>
                {trendsQ.data.weeks.map((w) => (
                  <th key={w}>{w}</th>
                ))}
                <th>8w avg</th>
              </tr>
            </thead>
            <tbody>
              {trendsQ.data.sectors.map((row) => (
                <tr key={row.name}>
                  <td className="sticky-col">{row.name}</td>
                  {row.cells.map((cell, i) => (
                    <td key={cell.week}>
                      <button
                        type="button"
                        className="trend-cell"
                        style={{ background: colorFor(cell.pct) }}
                        onClick={() => setDrill({ sector: row.name, weekIndex: i })}
                        title={`${cell.avg_above}/${cell.total}`}
                      >
                        <div className="trend-pct">{fmtPct(cell.pct)}</div>
                        <div className="trend-sub">
                          {cell.avg_above}/{cell.total}
                        </div>
                      </button>
                    </td>
                  ))}
                  <td>
                    <strong>{fmtPct(row.avg8)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {drill ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16 }}>
                {drill.sector} · week {drill.weekIndex + 1}
              </h2>
              {drillQ.data ? (
                <p className="page-sub">
                  {drillQ.data.week} · breadth {fmtPct(drillQ.data.breadth)} (
                  {drillQ.data.above}/{drillQ.data.total})
                </p>
              ) : null}
            </div>
            <button type="button" className="btn ghost" onClick={() => setDrill(null)}>
              Close
            </button>
          </div>
          {drillQ.isLoading ? <LoadingBlock rows={3} /> : null}
          {drillQ.data ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Close</th>
                  <th>vs MA</th>
                  <th>Above</th>
                </tr>
              </thead>
              <tbody>
                {drillQ.data.constituents.map((c) => (
                  <tr key={c.symbol}>
                    <td>{c.symbol}</td>
                    <td>{c.close.toFixed(2)}</td>
                    <td className={c.pct_vs_ma >= 0 ? "pos" : "neg"}>{fmtPct(c.pct_vs_ma)}</td>
                    <td>{c.above ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
