import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageShell,
} from "@/components/PageShell";
import {
  deleteBook,
  fetchBook,
  fetchBookPages,
  fetchBooks,
  renameBook,
} from "@/lib/marketsApi";

export function LibraryPage() {
  const qc = useQueryClient();
  const booksQ = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [readerId, setReaderId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [fontPx, setFontPx] = useState(18);
  const [theme, setTheme] = useState<"light" | "sepia" | "dark">("light");
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const bookQ = useQuery({
    queryKey: ["book", readerId],
    queryFn: () => fetchBook(readerId!),
    enabled: readerId != null,
  });
  const pagesQ = useQuery({
    queryKey: ["book-pages", readerId, page],
    queryFn: () => fetchBookPages(readerId!, page, page),
    enabled: readerId != null,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (readerId == null) return;
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight")
        setPage((p) => Math.min((bookQ.data?.page_count ?? 1) - 1, p + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readerId, bookQ.data?.page_count]);

  const delM = useMutation({
    mutationFn: (id: number) => deleteBook(id),
    onSuccess: () => {
      setReaderId(null);
      qc.invalidateQueries({ queryKey: ["books"] });
    },
  });

  if (readerId != null) {
    const pg = pagesQ.data?.[0];
    const total = bookQ.data?.page_count ?? 0;
    return (
      <div className={`reader theme-${theme}`}>
        <header className="reader-bar">
          <button type="button" className="btn ghost" onClick={() => setReaderId(null)}>
            ← Shelf
          </button>
          <strong>{bookQ.data?.title ?? "…"}</strong>
          <div className="row gap">
            <button type="button" className="btn ghost" onClick={() => setFontPx((f) => f - 1)}>
              A−
            </button>
            <button type="button" className="btn ghost" onClick={() => setFontPx((f) => f + 1)}>
              A+
            </button>
            <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
              <option value="light">Light</option>
              <option value="sepia">Sepia</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </header>
        <main className="reader-page" style={{ fontSize: fontPx }}>
          {pagesQ.isLoading ? <LoadingBlock /> : null}
          {pg ? (
            <>
              {pg.chapter ? <h3>{pg.chapter}</h3> : null}
              <div className="reader-text">{pg.text || "(empty page)"}</div>
            </>
          ) : (
            <EmptyState title="No page text" />
          )}
        </main>
        <footer className="reader-bar">
          <button
            type="button"
            className="btn ghost"
            disabled={page <= 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span>
            Page {page + 1} of {total || "?"}
          </span>
          <button
            type="button"
            className="btn ghost"
            disabled={total > 0 && page >= total - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </footer>
        {bookQ.data?.suggestions?.length ? (
          <aside className="card" style={{ margin: 16 }}>
            <div className="card-kicker">Suggestions</div>
            <ul>
              {bookQ.data.suggestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p className="page-sub">Ask / cite streaming uses POST /library/books/{readerId}/ask</p>
          </aside>
        ) : null}
      </div>
    );
  }

  return (
    <PageShell title="Library" subtitle="Shelf of ingested PDFs" maxWidth={1100}>
      {booksQ.isLoading ? <LoadingBlock /> : null}
      {booksQ.isError ? <ErrorBlock message="Library API unreachable." /> : null}
      {!booksQ.isLoading && (booksQ.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No books yet"
          copy="Upload a PDF from Admin · Book Library ingestion."
        />
      ) : null}
      <div className="shelf-grid">
        {(booksQ.data ?? []).map((b) => (
          <div key={b.id} className="shelf-book card">
            <div
              className="spine"
              style={{ background: b.spine_color || "var(--accent, #3C2CDA)" }}
            />
            <div>
              <strong>{b.title}</strong>
              <div className="page-sub">
                {b.kind} · {b.status} · {b.page_count ?? 0}p · {b.progress_pct ?? 0}%
              </div>
              <div className="row gap" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={b.status !== "ready"}
                  onClick={() => {
                    setReaderId(b.id);
                    setPage(0);
                  }}
                >
                  Read
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setRenameId(b.id);
                    setRenameTitle(b.title);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    if (confirm(`Delete “${b.title}”?`)) delM.mutate(b.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {renameId != null ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Rename</h3>
          <input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
          <div className="row gap" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await renameBook(renameId, renameTitle);
                setRenameId(null);
                qc.invalidateQueries({ queryKey: ["books"] });
              }}
            >
              Save
            </button>
            <button type="button" className="btn ghost" onClick={() => setRenameId(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
