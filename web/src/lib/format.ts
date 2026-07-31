export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function fmtPrice(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export function fmtDateLabel(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function fmtTs(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function fmtInr(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}₹${Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtWeekLabel(week: string): string {
  // "2026-W12" → "W12"
  const m = week.match(/W(\d+)/i);
  return m ? `W${m[1]}` : week;
}
