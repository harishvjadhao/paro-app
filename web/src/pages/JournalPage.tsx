import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageShell,
  StatCard,
} from "@/components/PageShell";
import {
  createTrade,
  deleteTrade,
  downloadText,
  exportJournalCsv,
  fetchJournalAnalytics,
  fetchTrades,
  importJournalCsv,
} from "@/lib/marketsApi";
import { usePrefs } from "@/store/prefs";
import type { DefaultSegment } from "@/lib/types";

export function JournalPage() {
  const qc = useQueryClient();
  const defaultSegment = usePrefs((s) => s.defaultSegment);
  const tradesQ = useQuery({ queryKey: ["journal-trades"], queryFn: () => fetchTrades() });
  const analyticsQ = useQuery({
    queryKey: ["journal-analytics"],
    queryFn: fetchJournalAnalytics,
  });
  const [openOnly, setOpenOnly] = useState(false);
  const [tag, setTag] = useState("");
  const [form, setForm] = useState({
    symbol: "",
    segment: defaultSegment as DefaultSegment,
    qty: 1,
    buy_price: 0,
    sell_price: "",
    entry_date: new Date().toISOString().slice(0, 10),
    exit_date: "",
    note: "",
    tags: "",
  });

  const createM = useMutation({
    mutationFn: () =>
      createTrade({
        symbol: form.symbol,
        segment: form.segment,
        qty: Number(form.qty),
        buy_price: Number(form.buy_price),
        sell_price: form.sell_price === "" ? null : Number(form.sell_price),
        entry_date: form.entry_date,
        exit_date: form.exit_date || null,
        note: form.note,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-trades"] });
      qc.invalidateQueries({ queryKey: ["journal-analytics"] });
    },
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => deleteTrade(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-trades"] });
      qc.invalidateQueries({ queryKey: ["journal-analytics"] });
    },
  });

  const filtered = useMemo(() => {
    let rows = tradesQ.data ?? [];
    if (openOnly) rows = rows.filter((t) => t.sell_price == null);
    if (tag.trim()) rows = rows.filter((t) => (t.tags || []).includes(tag.trim()));
    return rows;
  }, [tradesQ.data, openOnly, tag]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createM.mutate();
  };

  return (
    <PageShell
      title="Trading Journal"
      subtitle="Zerodha delivery DP ₹15.34 on sell · unrealized for open trades"
      maxWidth={1200}
      actions={
        <div className="row gap">
          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              const csv = await exportJournalCsv();
              downloadText("paro-journal.csv", csv, "text/csv");
            }}
          >
            Export CSV
          </button>
          <label className="btn ghost">
            Import
            <input
              type="file"
              accept=".csv"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                await importJournalCsv(f);
                qc.invalidateQueries({ queryKey: ["journal-trades"] });
                e.target.value = "";
              }}
            />
          </label>
        </div>
      }
    >
      <div className="stat-grid">
        <StatCard label="Open" value={analyticsQ.data?.open_count ?? "—"} />
        <StatCard label="Closed" value={analyticsQ.data?.closed_count ?? "—"} />
        <StatCard
          label="Equity"
          value={
            analyticsQ.data?.equity_curve?.length
              ? analyticsQ.data.equity_curve.at(-1)!.equity.toFixed(2)
              : "—"
          }
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>New trade</h2>
        <form className="form-grid" onSubmit={onSubmit}>
          <input
            required
            placeholder="Symbol"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
          />
          <select
            value={form.segment}
            onChange={(e) =>
              setForm({ ...form, segment: e.target.value as DefaultSegment })
            }
          >
            <option value="Delivery">Delivery</option>
            <option value="Intraday">Intraday</option>
          </select>
          <input
            type="number"
            min={1}
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Buy"
            value={form.buy_price || ""}
            onChange={(e) => setForm({ ...form, buy_price: Number(e.target.value) })}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Sell (blank=open)"
            value={form.sell_price}
            onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
          />
          <input
            type="date"
            value={form.entry_date}
            onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
          />
          <input
            type="date"
            value={form.exit_date}
            onChange={(e) => setForm({ ...form, exit_date: e.target.value })}
          />
          <input
            placeholder="tags (comma)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
          <input
            placeholder="note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <button type="submit" className="btn" disabled={createM.isPending}>
            Add
          </button>
        </form>
      </div>

      <div className="row gap" style={{ margin: "16px 0" }}>
        <label className="row gap">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Open only
        </label>
        <input
          placeholder="Filter tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>

      {tradesQ.isLoading ? <LoadingBlock /> : null}
      {tradesQ.isError ? <ErrorBlock message="Could not load trades." /> : null}
      {!tradesQ.isLoading && filtered.length === 0 ? (
        <EmptyState title="No trades" copy="Add a trade or import a CSV." />
      ) : null}
      {filtered.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Seg</th>
              <th>Qty</th>
              <th>Buy</th>
              <th>Sell</th>
              <th>Charges</th>
              <th>Net / Unreal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>{t.entry_date}</td>
                <td>{t.symbol}</td>
                <td>{t.segment}</td>
                <td>{t.qty}</td>
                <td>{t.buy_price}</td>
                <td>{t.sell_price ?? "—"}</td>
                <td>{t.charges.total.toFixed(2)}</td>
                <td className={(t.charges.net || t.charges.unrealized || 0) >= 0 ? "pos" : "neg"}>
                  {t.sell_price == null
                    ? (t.charges.unrealized ?? 0).toFixed(2)
                    : t.charges.net.toFixed(2)}
                </td>
                <td>
                  <button type="button" className="btn ghost" onClick={() => deleteM.mutate(t.id)}>
                    Del
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {analyticsQ.data?.equity_curve?.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 15 }}>Equity curve</h2>
          <svg width="100%" height="120" viewBox="0 0 400 120" preserveAspectRatio="none">
            {(() => {
              const pts = analyticsQ.data!.equity_curve;
              const ys = pts.map((p) => p.equity);
              const min = Math.min(...ys, 0);
              const max = Math.max(...ys, 1);
              const path = pts
                .map((p, i) => {
                  const x = (i / Math.max(pts.length - 1, 1)) * 400;
                  const y = 110 - ((p.equity - min) / Math.max(max - min, 1)) * 100;
                  return `${i === 0 ? "M" : "L"}${x},${y}`;
                })
                .join(" ");
              return <path d={path} fill="none" stroke="var(--accent, #3C2CDA)" strokeWidth="2" />;
            })()}
          </svg>
        </div>
      ) : null}
    </PageShell>
  );
}
