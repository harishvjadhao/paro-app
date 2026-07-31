const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/csv") || ct.includes("text/plain")) {
    return (await res.text()) as T;
  }
  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function apiDelete<T = { ok: boolean }>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: "POST", body: form });
}

/** Soft GET that returns null on 404 (for optional Phase 5/6 endpoints). */
export async function apiGetOptional<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function streamSse(
  path: string,
  body: unknown,
  opts: {
    signal?: AbortSignal;
    onEvent: (data: Record<string, unknown>) => void;
  },
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || `${res.status} ${res.statusText}`);
  }
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() || "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        opts.onEvent(JSON.parse(payload) as Record<string, unknown>);
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}

export { API_BASE };
