import { applyTheme } from './theme'

export type TradeSegment = 'Delivery' | 'Intraday'

const DEFAULT_SEGMENT_KEY = 'paro.defaultSegment'

/** Known UI preference keys cleared by Settings › Clear local data. Never touches server APIs. */
export const LOCAL_PREF_KEYS = [
  'paro.theme',
  'paro.defaultSegment',
  'ws:selected',
  'ws:dense',
  'ws:bb',
  'ws:rsi',
  'ws:tf',
  'ws:search',
  'ws:filter',
  'ws:collapseAll',
  'ws:collapsed',
  'list:search',
  'list:sortBy',
  'list:sortDir',
  'list:groupBy',
  'list:filters',
  'list:closed',
  'list:limit',
  'list:hiddenBuiltins',
  'sec:selected',
  'sec:pins',
] as const

export function getDefaultSegment(): TradeSegment {
  const value = localStorage.getItem(DEFAULT_SEGMENT_KEY)
  return value === 'Intraday' ? 'Intraday' : 'Delivery'
}

export function setDefaultSegment(segment: TradeSegment): void {
  localStorage.setItem(DEFAULT_SEGMENT_KEY, segment)
}

export function clearLocalPrefs(): void {
  for (const key of LOCAL_PREF_KEYS) {
    localStorage.removeItem(key)
  }
  // Also sweep any leftover paro.* / screen-prefixed keys without touching unrelated origins.
  const extra: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key) continue
    if (
      key.startsWith('paro.') ||
      key.startsWith('ws:') ||
      key.startsWith('list:') ||
      key.startsWith('sec:') ||
      key.startsWith('paro:')
    ) {
      extra.push(key)
    }
  }
  extra.forEach((key) => localStorage.removeItem(key))
  applyTheme('default')
}
