import { usePrefs } from "@/store/prefs";
import type { DefaultSegment, ThemeId } from "@/lib/types";

const THEMES: Array<{ id: ThemeId; label: string }> = [
  { id: "default", label: "Default" },
  { id: "sky", label: "Sky Blue" },
  { id: "dark", label: "Dark" },
];

export function SettingsPage() {
  const theme = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const defaultSegment = usePrefs((s) => s.defaultSegment);
  const setDefaultSegment = usePrefs((s) => s.setDefaultSegment);
  const clearLocalData = usePrefs((s) => s.clearLocalData);

  return (
    <div className="settings">
      <div className="settings-inner">
        <h1>Settings</h1>
        <p className="settings-sub">
          Theme, default trade segment, and local preferences.
        </p>

        <section className="card settings-card">
          <div className="card-kicker mb">Theme</div>
          <div className="theme-row">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-btn${theme === t.id ? " is-on" : ""}`}
                onClick={() => setTheme(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card settings-card">
          <div className="card-kicker mb">Default segment</div>
          <div className="theme-row">
            {(["Delivery", "Intraday"] as DefaultSegment[]).map((seg) => (
              <button
                key={seg}
                type="button"
                className={`theme-btn${defaultSegment === seg ? " is-on" : ""}`}
                onClick={() => setDefaultSegment(seg)}
              >
                {seg}
              </button>
            ))}
          </div>
        </section>

        <section className="card settings-card">
          <div className="card-kicker mb">Local data</div>
          <p className="page-sub">
            Clears theme, filters, chart toggles, and last screen from this browser. Does not clear
            server data.
          </p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              if (confirm("Clear local PaRo preferences?")) clearLocalData();
            }}
          >
            Clear local data
          </button>
        </section>
      </div>
    </div>
  );
}
