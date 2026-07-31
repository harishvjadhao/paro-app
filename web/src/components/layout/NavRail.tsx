import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { usePrefs } from "@/store/prefs";
import type { ScreenId, StockFilter } from "@/lib/types";

type NavItem = {
  to: string;
  icon: string;
  label: string;
  filter?: StockFilter;
  screen: ScreenId;
};

const ITEMS: NavItem[] = [
  {
    to: "/?filter=all",
    icon: "layout-dashboard",
    label: "Market workspace",
    filter: "all",
    screen: "workspace",
  },
  {
    to: "/?filter=ma",
    icon: "activity",
    label: "Signals · above 44 MA",
    filter: "ma",
    screen: "workspace",
  },
  {
    to: "/?filter=watch",
    icon: "bookmark",
    label: "Watchlist",
    filter: "watch",
    screen: "workspace",
  },
  {
    to: "/?filter=fav",
    icon: "flask-conical",
    label: "Research · favorites",
    filter: "fav",
    screen: "workspace",
  },
  { to: "/sector", icon: "layers", label: "Sector analysis", screen: "sector" },
  {
    to: "/trends",
    icon: "bar-chart-3",
    label: "Weekly sector trends",
    screen: "trends",
  },
  {
    to: "/journal",
    icon: "notebook-pen",
    label: "Trading journal",
    screen: "journal",
  },
  { to: "/library", icon: "book-open", label: "Library · reader", screen: "library" },
  { to: "/admin", icon: "sliders-horizontal", label: "Admin", screen: "admin" },
];

export function NavRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const filter = usePrefs((s) => s.filter);
  const setFilter = usePrefs((s) => s.setFilter);
  const setLastScreen = usePrefs((s) => s.setLastScreen);

  const isWorkspace = location.pathname === "/" || location.pathname === "";

  return (
    <div className="rail-outer">
      <div className="rail-inner">
        <div className="rail-brand" title="PaRo">
          P
        </div>
        {ITEMS.map((item) => {
          const active =
            item.screen === "workspace"
              ? isWorkspace && filter === item.filter
              : location.pathname.startsWith(item.to);
          return (
            <button
              key={item.to + (item.filter || "")}
              type="button"
              title={item.label}
              className={`rail-btn${active ? " is-active" : ""}`}
              onClick={() => {
                setLastScreen(item.screen);
                if (item.filter) setFilter(item.filter);
                navigate(item.to);
              }}
            >
              <Icon name={item.icon} size={18} />
            </button>
          );
        })}
        <NavLink
          to="/settings"
          title="Settings"
          className={({ isActive }) =>
            `rail-btn rail-settings${isActive ? " is-active" : ""}`
          }
          onClick={() => setLastScreen("settings")}
        >
          <Icon name="settings" size={18} />
        </NavLink>
      </div>
    </div>
  );
}
