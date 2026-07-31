import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { usePrefs } from "@/store/prefs";
import type { IndustryGroup, ScreenId, StockFilter } from "@/lib/types";

type PaletteItem = {
  id: string;
  icon: string;
  label: string;
  kind: string;
  onPick: () => void;
};

const SCREENS: Array<{
  label: string;
  screen: ScreenId;
  path: string;
  icon: string;
  filter?: StockFilter;
}> = [
  {
    label: "Market workspace",
    screen: "workspace",
    path: "/",
    icon: "layout-dashboard",
    filter: "all",
  },
  {
    label: "Sector analysis",
    screen: "sector",
    path: "/sector",
    icon: "layers",
  },
  {
    label: "Weekly sector trends",
    screen: "trends",
    path: "/trends",
    icon: "bar-chart-3",
  },
  {
    label: "Trading journal",
    screen: "journal",
    path: "/journal",
    icon: "notebook-pen",
  },
  { label: "Library", screen: "library", path: "/library", icon: "book-open" },
  {
    label: "Admin",
    screen: "admin",
    path: "/admin",
    icon: "sliders-horizontal",
  },
  {
    label: "Settings",
    screen: "settings",
    path: "/settings",
    icon: "settings",
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
  groups: IndustryGroup[] | undefined;
};

export function CommandPalette({ open, onClose, groups }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const setFilter = usePrefs((s) => s.setFilter);
  const setLastScreen = usePrefs((s) => s.setLastScreen);
  const setSelected = usePrefs((s) => s.setSelected);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo(() => {
    const pq = query.trim().toLowerCase();
    const out: PaletteItem[] = [];

    SCREENS.forEach((sc) => {
      if (!pq || sc.label.toLowerCase().includes(pq)) {
        out.push({
          id: `sc-${sc.screen}`,
          icon: sc.icon,
          label: sc.label,
          kind: "Screen",
          onPick: () => {
            setLastScreen(sc.screen);
            if (sc.filter) setFilter(sc.filter);
            navigate(sc.path);
            onClose();
          },
        });
      }
    });

    const industries = new Set(
      (groups || []).map((g) => g.industry).filter(Boolean),
    );
    industries.forEach((nm) => {
      if (!pq || nm.toLowerCase().includes(pq)) {
        out.push({
          id: `se-${nm}`,
          icon: "layers",
          label: nm,
          kind: "Sector",
          onPick: () => {
            setLastScreen("sector");
            navigate("/sector");
            onClose();
          },
        });
      }
    });

    (groups || []).forEach((g) => {
      g.stocks.forEach((s) => {
        if (
          !pq ||
          s.symbol.toLowerCase().includes(pq) ||
          s.company.toLowerCase().includes(pq)
        ) {
          out.push({
            id: `st-${s.symbol}`,
            icon: "trending-up",
            label: `${s.symbol} · ${s.company}`,
            kind: "Stock",
            onPick: () => {
              setLastScreen("workspace");
              setSelected(s.symbol);
              navigate("/?filter=all");
              setFilter("all");
              onClose();
            },
          });
        }
      });
    });

    return out.slice(0, 9);
  }, [
    groups,
    navigate,
    onClose,
    query,
    setFilter,
    setLastScreen,
    setSelected,
  ]);

  if (!open) return null;

  return (
    <div className="palette-backdrop" onClick={onClose} role="presentation">
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="palette-head">
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a stock, sector, or screen…"
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="palette-body">
          {items.length === 0 ? (
            <div className="palette-empty">No matches.</div>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                type="button"
                className="palette-item"
                onClick={it.onPick}
              >
                <Icon name={it.icon} size={16} />
                <span className="palette-label">{it.label}</span>
                <span className="palette-kind">{it.kind}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
