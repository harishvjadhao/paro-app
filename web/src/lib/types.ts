export type StockFilter = "all" | "ma" | "fav" | "watch";
export type Timeframe = "D" | "W" | "M";
export type ThemeId = "default" | "sky" | "dark";
export type ScreenId =
  | "workspace"
  | "sector"
  | "trends"
  | "journal"
  | "library"
  | "admin"
  | "settings";
export type DefaultSegment = "Delivery" | "Intraday";

export type StockListItem = {
  symbol: string;
  company: string;
  industry: string;
  series: string;
  isin: string;
  yahoo_symbol: string;
  close: number | null;
  ma44: number | null;
  above: boolean | null;
  pct_vs_ma: number | null;
  as_of: string | null;
  favorite: boolean;
  watchlist: boolean;
  industry_sort_order: number;
};

export type IndustryGroup = {
  industry: string;
  stocks: StockListItem[];
};

export type StockDetail = {
  symbol: string;
  company: string;
  industry: string;
  series: string;
  isin: string;
  yahoo_symbol: string;
  close: number | null;
  ma44: number | null;
  above: boolean | null;
  pct_vs_ma: number | null;
  as_of: string | null;
};

export type CandleBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type BollingerOut = {
  mid: (number | null)[];
  up: (number | null)[];
  lo: (number | null)[];
};

export type CandlesResponse = {
  symbol: string;
  timeframe: string;
  bars: CandleBar[];
  ma44: (number | null)[];
  bb: BollingerOut | null;
  rsi: (number | null)[] | null;
  highlights: Array<{ date?: string; ts?: string; label?: string; color?: string }>;
  comments: Array<{ id?: number; date?: string }>;
};

export type Comment = {
  id: number;
  symbol: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type WatchToggle = {
  symbol: string;
  favorite: boolean;
  watchlist: boolean;
};

export type UniverseStock = {
  symbol: string;
  company: string;
  industry: string;
  series: string;
  isin: string;
  yahoo_symbol: string;
  active: boolean;
};

export type Health = {
  status: string;
  service: string;
};

export type SectorConstituent = {
  symbol: string;
  company: string;
  close: number;
  ma44: number;
  above: boolean;
  pct_vs_ma: number;
};

export type SectorBreadth = {
  industry: string;
  as_of: string;
  breadth: number;
  above: number;
  total: number;
  constituents: SectorConstituent[];
  leaders: SectorConstituent[];
};

export type WeeklyCell = {
  week: string;
  pct: number;
  avg_above: number;
  total: number;
};

export type WeeklySectorRow = {
  name: string;
  cells: WeeklyCell[];
  avg8: number;
};

export type WeeklyTrends = {
  weeks: string[];
  sectors: WeeklySectorRow[];
};

export type WeeklyDrill = SectorBreadth & {
  week: string;
  weekIndex: number;
};

export type RotationPoint = {
  sector: string;
  x: number;
  y: number;
  breadth: number;
};

export type TradeCharges = {
  brokerage: number;
  stt: number;
  txn: number;
  sebi: number;
  stamp: number;
  gst: number;
  dp: number;
  total: number;
  gross: number;
  net: number;
  unrealized: number | null;
};

export type JournalTrade = {
  id: number;
  symbol: string;
  segment: string;
  qty: number;
  buy_price: number;
  sell_price: number | null;
  entry_date: string;
  exit_date: string | null;
  note: string;
  tags: string[];
  created_at: string | null;
  charges: TradeCharges;
};

export type JournalAnalytics = {
  equity_curve: Array<{ date: string; equity: number }>;
  by_segment: Record<string, number>;
  by_symbol: Record<string, number>;
  open_count: number;
  closed_count: number;
};

export type ChartHighlight = {
  id: number;
  date: string;
  label: string;
  color: string | null;
};

export type SyncRun = {
  id: number;
  mode: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  processed: number;
  updated: number;
  failed: number;
  error: string | null;
};

export type SyncRunItem = {
  id: number;
  run_id: number;
  symbol: string;
  status: string;
  rows_written: number;
  window_start: string | null;
  window_end: string | null;
  message: string | null;
};

export type SyncRunDetail = SyncRun & { items: SyncRunItem[] };

export type UniverseUpload = {
  id: number;
  filename: string;
  total: number;
  duplicates: number;
  invalid: number;
  uploaded_at: string;
  replaced: boolean;
  invalid_messages: string[];
};

export type AppSettings = {
  default_user_id: string;
  tz: string;
  price_provider: string;
};

export type BookShelfItem = {
  id: number;
  title: string;
  author?: string;
  tag?: string;
  kind?: string;
  status?: string;
  page_count?: number;
  chunk_count?: number;
  spine_color?: string;
  progress_pct?: number;
};

export type BookDetail = BookShelfItem & {
  toc?: Array<{ chapter: string; page_index: number }>;
  suggestions?: string[];
  token_count?: number;
  ocr_confidence?: number | null;
};
