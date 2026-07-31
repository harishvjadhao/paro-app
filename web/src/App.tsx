import { useQuery } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";
import { apiGet } from "./lib/api";

type Health = { status: string; service: string };

function Shell() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<Health>("/health"),
    retry: false,
  });

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">PaRo</div>
        <nav>
          <Link to="/">Workspace</Link>
        </nav>
      </aside>
      <main className="main">
        <header className="top">
          <h1>PaRo</h1>
          <p className="muted">Nifty-200 workspace shell</p>
        </header>
        <section className="card-free">
          <p>
            API health:{" "}
            {health.isLoading
              ? "checking…"
              : health.isError
                ? "unreachable (start api when ready)"
                : `${health.data?.status} · ${health.data?.service}`}
          </p>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}
