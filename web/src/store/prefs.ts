import { create } from "zustand";
import type {
  DefaultSegment,
  ScreenId,
  StockFilter,
  ThemeId,
  Timeframe,
} from "@/lib/types";

const STORAGE_KEY = "paro:v1";

type PrefsState = {
  theme: ThemeId;
  filter: StockFilter;
  lastScreen: ScreenId;
  defaultSegment: DefaultSegment;
  timeframe: Timeframe;
  bollinger: boolean;
  rsi: boolean;
  dense: boolean;
  collapsed: Record<string, boolean>;
  selected: string | null;
  setTheme: (theme: ThemeId) => void;
  setFilter: (filter: StockFilter) => void;
  setLastScreen: (screen: ScreenId) => void;
  setDefaultSegment: (segment: DefaultSegment) => void;
  setTimeframe: (tf: Timeframe) => void;
  toggleBollinger: () => void;
  toggleRsi: () => void;
  toggleDense: () => void;
  setSelected: (symbol: string | null) => void;
  toggleCollapsed: (industry: string) => void;
  setCollapsedAll: (industries: string[], collapse: boolean) => void;
  hydrate: () => void;
  clearLocalData: () => void;
};

type Persisted = {
  theme?: ThemeId;
  filter?: StockFilter;
  screen?: ScreenId;
  defaultSegment?: DefaultSegment;
  timeframe?: Timeframe;
  bollinger?: boolean;
  rsi?: boolean;
  dense?: boolean;
  collapsed?: Record<string, boolean>;
  selected?: string | null;
};

function readStored(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Persisted;
  } catch {
    return {};
  }
}

function writeStored(state: PrefsState) {
  try {
    const snap: Persisted = {
      theme: state.theme,
      filter: state.filter,
      screen: state.lastScreen,
      defaultSegment: state.defaultSegment,
      timeframe: state.timeframe,
      bollinger: state.bollinger,
      rsi: state.rsi,
      dense: state.dense,
      collapsed: state.collapsed,
      selected: state.selected,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* ignore quota */
  }
}

export const usePrefs = create<PrefsState>((set, get) => ({
  theme: "default",
  filter: "all",
  lastScreen: "workspace",
  defaultSegment: "Delivery",
  timeframe: "D",
  bollinger: false,
  rsi: false,
  dense: false,
  collapsed: {},
  selected: null,

  setTheme: (theme) => {
    set({ theme });
    writeStored(get());
  },
  setFilter: (filter) => {
    set({ filter });
    writeStored(get());
  },
  setLastScreen: (lastScreen) => {
    set({ lastScreen });
    writeStored(get());
  },
  setDefaultSegment: (defaultSegment) => {
    set({ defaultSegment });
    writeStored(get());
  },
  setTimeframe: (timeframe) => {
    set({ timeframe });
    writeStored(get());
  },
  toggleBollinger: () => {
    set((s) => ({ bollinger: !s.bollinger }));
    writeStored(get());
  },
  toggleRsi: () => {
    set((s) => ({ rsi: !s.rsi }));
    writeStored(get());
  },
  toggleDense: () => {
    set((s) => ({ dense: !s.dense }));
    writeStored(get());
  },
  setSelected: (selected) => {
    set({ selected });
    writeStored(get());
  },
  toggleCollapsed: (industry) => {
    set((s) => ({
      collapsed: { ...s.collapsed, [industry]: !s.collapsed[industry] },
    }));
    writeStored(get());
  },
  setCollapsedAll: (industries, collapse) => {
    const next: Record<string, boolean> = {};
    industries.forEach((i) => {
      next[i] = collapse;
    });
    set({ collapsed: next });
    writeStored(get());
  },
  hydrate: () => {
    const sv = readStored();
    set({
      theme: sv.theme ?? "default",
      filter: sv.filter ?? "all",
      lastScreen: sv.screen ?? "workspace",
      defaultSegment: sv.defaultSegment ?? "Delivery",
      timeframe: sv.timeframe ?? "D",
      bollinger: !!sv.bollinger,
      rsi: !!sv.rsi,
      dense: !!sv.dense,
      collapsed: sv.collapsed ?? {},
      selected: sv.selected ?? null,
    });
  },
  clearLocalData: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    set({
      theme: "default",
      filter: "all",
      lastScreen: "workspace",
      defaultSegment: "Delivery",
      timeframe: "D",
      bollinger: false,
      rsi: false,
      dense: false,
      collapsed: {},
      selected: null,
    });
  },
}));
