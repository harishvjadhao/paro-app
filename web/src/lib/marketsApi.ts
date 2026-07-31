import {
  API_BASE,
  ApiError,
  apiDelete,
  apiGet,
  apiGetOptional,
  apiPatch,
  apiPost,
  apiUpload,
  streamSse,
} from "./api";
import type {
  AppSettings,
  BookDetail,
  BookShelfItem,
  ChartHighlight,
  JournalAnalytics,
  JournalTrade,
  RotationPoint,
  SectorBreadth,
  SyncRun,
  SyncRunDetail,
  UniverseUpload,
  WeeklyDrill,
  WeeklyTrends,
} from "./types";

export function fetchSectors() {
  return apiGet<SectorBreadth[]>("/sectors");
}

export function fetchSector(name: string) {
  return apiGet<SectorBreadth>(`/sectors/${encodeURIComponent(name)}`);
}

export function fetchRotation() {
  return apiGet<RotationPoint[]>("/sectors/rotation");
}

export function fetchWeeklyTrends() {
  return apiGet<WeeklyTrends>("/trends/weekly");
}

export function fetchWeeklyDrill(sector: string, weekIndex: number) {
  return apiGet<WeeklyDrill>(
    `/trends/weekly/${encodeURIComponent(sector)}/${weekIndex}`,
  );
}

export function fetchTrades(opts?: {
  openOnly?: boolean;
  symbol?: string;
  tag?: string;
}) {
  const params = new URLSearchParams();
  if (opts?.openOnly) params.set("open_only", "true");
  if (opts?.symbol) params.set("symbol", opts.symbol);
  if (opts?.tag) params.set("tag", opts.tag);
  const q = params.toString();
  return apiGet<JournalTrade[]>(`/journal/trades${q ? `?${q}` : ""}`);
}

export function createTrade(body: {
  symbol: string;
  segment: string;
  qty: number;
  buy_price: number;
  sell_price?: number | null;
  entry_date: string;
  exit_date?: string | null;
  note?: string;
  tags?: string[];
}) {
  return apiPost<JournalTrade>("/journal/trades", body);
}

export function updateTrade(
  id: number,
  body: Partial<{
    symbol: string;
    segment: string;
    qty: number;
    buy_price: number;
    sell_price: number | null;
    entry_date: string;
    exit_date: string | null;
    note: string;
    tags: string[];
  }>,
) {
  return apiPatch<JournalTrade>(`/journal/trades/${id}`, body);
}

export function deleteTrade(id: number) {
  return apiDelete(`/journal/trades/${id}`);
}

export function fetchJournalAnalytics() {
  return apiGet<JournalAnalytics>("/journal/analytics");
}

export async function exportJournalCsv(): Promise<string> {
  return apiGet<string>("/journal/export");
}

export function importJournalCsv(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<{ imported: number }>("/journal/import", form);
}

export function fetchHighlights() {
  return apiGet<ChartHighlight[]>("/highlights");
}

export function createHighlight(body: {
  date: string;
  label: string;
  color?: string | null;
}) {
  return apiPost<ChartHighlight>("/highlights", body);
}

export function deleteHighlight(id: number) {
  return apiDelete(`/highlights/${id}`);
}

export function fetchSettings() {
  return apiGet<AppSettings>("/settings");
}

export function uploadUniverse(
  file: File,
  opts: { replace?: boolean; confirmReplace?: boolean } = {},
) {
  const form = new FormData();
  form.append("file", file);
  form.append("replace", opts.replace ? "true" : "false");
  form.append("confirm_replace", opts.confirmReplace ? "true" : "false");
  return apiUpload<UniverseUpload>("/admin/universe/upload", form);
}

export function startSync(mode: "Full" | "Incremental") {
  return apiPost<SyncRun>("/admin/sync", { mode });
}

export function fetchSyncRuns(limit = 50) {
  return apiGet<SyncRun[]>(`/admin/sync/runs?limit=${limit}`);
}

export function fetchSyncRun(id: number) {
  return apiGet<SyncRunDetail>(`/admin/sync/runs/${id}`);
}

export function retryFailedSync(runId: number) {
  return apiPost<SyncRun>(`/admin/sync/runs/${runId}/retry-failed`);
}

export async function streamSectorChat(
  sector: string,
  question: string,
  opts: {
    signal?: AbortSignal;
    onToken: (token: string) => void;
  },
): Promise<void> {
  await streamSse(
    "/ai/sector-chat",
    { sector, question },
    {
      signal: opts.signal,
      onEvent: (data) => {
        if (typeof data.token === "string") opts.onToken(data.token);
      },
    },
  );
}

export async function fetchBooks(): Promise<BookShelfItem[]> {
  const data = await apiGetOptional<BookShelfItem[]>("/library/books");
  return data ?? [];
}

export async function fetchBook(id: number | string): Promise<BookDetail | null> {
  return apiGetOptional<BookDetail>(`/library/books/${encodeURIComponent(String(id))}`);
}

export function uploadBook(file: File, kind?: string) {
  const form = new FormData();
  form.append("file", file);
  if (kind) form.append("kind", kind);
  return apiUpload<{ book_id: number; job_id: number }>("/library/books/upload", form);
}

export function fetchIngestJob(jobId: number) {
  return apiGet<{
    id: number;
    book_id: number;
    state: string;
    pct: number;
    stage: string;
    error: string | null;
    report: Record<string, unknown> | null;
  }>(`/library/jobs/${jobId}`);
}

export function renameBook(id: number, title: string) {
  return apiPatch<{ id: number; title: string }>(`/library/books/${id}`, { title });
}

export function deleteBook(id: number) {
  return apiDelete(`/library/books/${id}`);
}

export function fetchBookPages(id: number, from = 0, to = 5) {
  return apiGet<Array<{ page_index: number; chapter: string; text: string }>>(
    `/library/books/${id}/pages?from_=${from}&to=${to}`,
  );
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function isNotFound(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}

export { API_BASE, ApiError };
