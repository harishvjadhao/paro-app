import type { CSSProperties, ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  maxWidth?: number | string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageShell({
  title,
  subtitle,
  maxWidth = 1200,
  actions,
  children,
}: Props) {
  const mw = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;
  return (
    <div className="page-shell">
      <div className="page-inner" style={{ maxWidth: mw }}>
        <div className="page-head">
          <div className="page-head-text">
            <h1 className="page-title">{title}</h1>
            {subtitle ? <p className="page-sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="page-actions">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="card stat-card">
      <div className="card-kicker">{label}</div>
      <div className={`stat-card-v${valueClass ? ` ${valueClass}` : ""}`}>
        {value}
      </div>
      {sub ? <div className="stat-card-sub">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  copy,
}: {
  title: string;
  copy?: string;
}) {
  return (
    <div className="dash-empty">
      <div className="empty-title">{title}</div>
      {copy ? <div className="empty-copy">{copy}</div> : null}
    </div>
  );
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skel-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel-card">
          <div className="skel-card-body">
            <div className="skel skel-line w48" />
            <div className="skel skel-line w80" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="dash-error">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="btn-ghost" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export const SECTOR_PALETTE = [
  "#3C2CDA",
  "#EA9D00",
  "#14CBDE",
  "#1D86FF",
  "#12A053",
  "#DC3545",
  "#8B5CF6",
];

export function breadthCellStyle(pct: number): CSSProperties {
  if (pct >= 60) {
    return {
      background: `rgba(18,160,83,${0.18 + ((pct - 60) / 40) * 0.35})`,
      color: "var(--gray-800)",
    };
  }
  if (pct <= 40) {
    return {
      background: `rgba(220,53,69,${0.18 + ((40 - pct) / 40) * 0.35})`,
      color: "var(--gray-800)",
    };
  }
  return { background: "var(--gray-100)", color: "var(--gray-700)" };
}
