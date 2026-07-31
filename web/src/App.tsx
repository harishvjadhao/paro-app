import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { NavRail } from "@/components/layout/NavRail";
import { CommandPalette } from "@/components/CommandPalette";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { SectorPage } from "@/pages/SectorPage";
import { TrendsPage } from "@/pages/TrendsPage";
import { JournalPage } from "@/pages/JournalPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { AdminPage } from "@/pages/AdminPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { usePrefs } from "@/store/prefs";
import { useStocks } from "@/hooks/useStocks";
import type { ScreenId } from "@/lib/types";

function screenFromPath(pathname: string): ScreenId {
  if (pathname.startsWith("/sector")) return "sector";
  if (pathname.startsWith("/trends")) return "trends";
  if (pathname.startsWith("/journal")) return "journal";
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/settings")) return "settings";
  return "workspace";
}

function ThemeRoot({ children }: { children: React.ReactNode }) {
  const theme = usePrefs((s) => s.theme);
  const hydrate = usePrefs((s) => s.hydrate);
  const location = useLocation();
  const setLastScreen = usePrefs((s) => s.setLastScreen);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "default") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    setLastScreen(screenFromPath(location.pathname));
  }, [location.pathname, setLastScreen]);

  return <>{children}</>;
}

function Shell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const filter = usePrefs((s) => s.filter);
  const stocks = useStocks(filter, "");
  const location = useLocation();
  const selected = usePrefs((s) => s.selected);
  const setSelected = usePrefs((s) => s.setSelected);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
        return;
      }
      if (
        e.key === "Escape" &&
        (location.pathname === "/" || location.pathname === "") &&
        selected
      ) {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location.pathname, paletteOpen, selected, setSelected]);

  return (
    <div className="app-shell">
      <NavRail />
      <div className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              <WorkspacePage onOpenPalette={() => setPaletteOpen(true)} />
            }
          />
          <Route path="/sector" element={<SectorPage />} />
          <Route path="/trends" element={<TrendsPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        groups={stocks.data}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeRoot>
      <Shell />
    </ThemeRoot>
  );
}
