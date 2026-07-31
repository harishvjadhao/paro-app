import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageShell,
} from "@/components/PageShell";
import { fetchUniverse } from "@/lib/stocksApi";
import {
  createHighlight,
  deleteHighlight,
  fetchHighlights,
  fetchIngestJob,
  fetchSyncRuns,
  startSync,
  uploadBook,
  uploadUniverse,
} from "@/lib/marketsApi";

export function AdminPage() {
  const qc = useQueryClient();
  const universeQ = useQuery({ queryKey: ["universe"], queryFn: fetchUniverse });
  const runsQ = useQuery({ queryKey: ["sync-runs"], queryFn: () => fetchSyncRuns(20) });
  const hlQ = useQuery({ queryKey: ["highlights"], queryFn: fetchHighlights });
  const [replace, setReplace] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hlDate, setHlDate] = useState(new Date().toISOString().slice(0, 10));
  const [hlLabel, setHlLabel] = useState("");
  const [hlColor, setHlColor] = useState("#3C2CDA");
  const [jobId, setJobId] = useState<number | null>(null);
  const jobQ = useQuery({
    queryKey: ["ingest-job", jobId],
    queryFn: () => fetchIngestJob(jobId!),
    enabled: jobId != null,
    refetchInterval: (q) => {
      const st = q.state.data?.state;
      return st && !["ready", "failed"].includes(st) ? 1500 : false;
    },
  });

  const uploadM = useMutation({
    mutationFn: (file: File) => uploadUniverse(file, { replace, confirmReplace }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["universe"] }),
  });

  const syncM = useMutation({
    mutationFn: (mode: "Full" | "Incremental") => startSync(mode),
    onMutate: () => setSyncing(true),
    onSettled: () => {
      setSyncing(false);
      qc.invalidateQueries({ queryKey: ["sync-runs"] });
    },
  });

  const hlM = useMutation({
    mutationFn: () => createHighlight({ date: hlDate, label: hlLabel, color: hlColor }),
    onSuccess: () => {
      setHlLabel("");
      qc.invalidateQueries({ queryKey: ["highlights"] });
    },
  });

  const running = syncing || syncM.isPending || runsQ.data?.some((r) => r.status === "running");

  return (
    <PageShell title="Admin" subtitle="Universe, sync, highlights, book ingestion" maxWidth={1100}>
      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Universe</h2>
        {universeQ.isLoading ? <LoadingBlock rows={2} /> : null}
        {universeQ.isError ? <ErrorBlock message="Universe unreachable." /> : null}
        <p className="page-sub">
          Active symbols: {universeQ.data?.length ?? 0}
          {!universeQ.isLoading && (universeQ.data?.length ?? 0) === 0
            ? " — upload Nifty-200 CSV to populate."
            : ""}
        </p>
        <div className="row gap" style={{ marginBottom: 10 }}>
          <label className="row gap">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Replace (destructive)
          </label>
          {replace ? (
            <label className="row gap">
              <input
                type="checkbox"
                checked={confirmReplace}
                onChange={(e) => setConfirmReplace(e.target.checked)}
              />
              Confirm replace
            </label>
          ) : null}
        </div>
        <label className="btn">
          Upload CSV
          <input
            type="file"
            accept=".csv"
            hidden
            disabled={running}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadM.mutate(f);
              e.target.value = "";
            }}
          />
        </label>
        {uploadM.data ? (
          <p className="page-sub">
            Uploaded {uploadM.data.filename}: total {uploadM.data.total}, dup{" "}
            {uploadM.data.duplicates}, invalid {uploadM.data.invalid}
          </p>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Price sync</h2>
        <div className="row gap">
          <button
            type="button"
            className="btn"
            disabled={running}
            onClick={() => syncM.mutate("Full")}
          >
            Full sync
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={running}
            onClick={() => syncM.mutate("Incremental")}
          >
            Incremental
          </button>
        </div>
        {runsQ.isLoading ? <LoadingBlock rows={2} /> : null}
        {(runsQ.data?.length ?? 0) === 0 && !runsQ.isLoading ? (
          <EmptyState title="No sync runs yet" />
        ) : null}
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Failed</th>
            </tr>
          </thead>
          <tbody>
            {(runsQ.data ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.mode}</td>
                <td>{r.status}</td>
                <td>{r.updated}</td>
                <td>{r.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Chart highlights</h2>
        <div className="form-grid">
          <input type="date" value={hlDate} onChange={(e) => setHlDate(e.target.value)} />
          <input
            placeholder="Label (same label ⇒ same color)"
            value={hlLabel}
            onChange={(e) => setHlLabel(e.target.value)}
          />
          <input type="color" value={hlColor} onChange={(e) => setHlColor(e.target.value)} />
          <button
            type="button"
            className="btn"
            disabled={!hlLabel}
            onClick={() => hlM.mutate()}
          >
            Add
          </button>
        </div>
        <ul>
          {(hlQ.data ?? []).map((h) => (
            <li key={h.id} className="row gap">
              <span style={{ color: h.color || undefined }}>●</span>
              {h.date} · {h.label}
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  deleteHighlight(h.id).then(() => qc.invalidateQueries({ queryKey: ["highlights"] }))
                }
              >
                Del
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Book Library · PDF Ingestion</h2>
        <p className="page-sub">Upload a PDF. Text PDFs parse directly; scanned use vision OCR.</p>
        <label className="btn">
          Upload PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const res = await uploadBook(f);
              setJobId(res.job_id);
              e.target.value = "";
            }}
          />
        </label>
        {jobQ.data ? (
          <div style={{ marginTop: 12 }}>
            <div>
              State: <strong>{jobQ.data.state}</strong> · {jobQ.data.pct}% · {jobQ.data.stage}
            </div>
            {jobQ.data.report ? (
              <pre style={{ fontSize: 12 }}>{JSON.stringify(jobQ.data.report, null, 2)}</pre>
            ) : null}
            {jobQ.data.error ? <ErrorBlock message={jobQ.data.error} /> : null}
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
