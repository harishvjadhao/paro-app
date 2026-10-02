import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Command,
  Database,
  ExternalLink,
  MessageSquare,
  Rows3,
  RefreshCw,
  Search,
  Square,
  Star,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { startSync } from '../api/sync'
import { PriceChart } from '../components/PriceChart'
import {
  addComment,
  type CandleItem,
  type ChartMarker,
  deleteComment,
  getStockCandles,
  getStockDetail,
  getStocks,
  reorderStocks,
  syncOne,
  toggleFavorite,
  toggleWatch,
  updateComment,
  type StockDetail,
  type StockListItem,
} from '../api/workspace'

type FilterKey = 'all' | 'ma' | 'watch' | 'fav'
type Timeframe = 'D' | 'W' | 'M'

const WORKSPACE_STORAGE_KEYS = {
  selected: 'ws:selected',
  dense: 'ws:dense',
  bb: 'ws:bb',
  rsi: 'ws:rsi',
  timeframe: 'ws:tf',
  search: 'ws:search',
  filter: 'ws:filter',
  collapseAll: 'ws:collapseAll',
  collapsed: 'ws:collapsed',
} as const

function groupByIndustry(rows: StockListItem[]): Record<string, StockListItem[]> {
  return rows.reduce<Record<string, StockListItem[]>>((acc, item) => {
    if (!acc[item.industry]) {
      acc[item.industry] = []
    }
    acc[item.industry].push(item)
    return acc
  }, {})
}

function parseDateOnly(value: string): Date | null {
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

function syncStateFromDate(lastSync: string): 'synced' | 'stale' {
  const parsed = parseDateOnly(lastSync)
  if (!parsed) {
    return 'stale'
  }

  const now = new Date()
  const diffDays = Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays <= 1 ? 'synced' : 'stale'
}

function signalLabelFromPct(pctVsMa: number): 'Above 44 MA' | 'Below 44 MA' {
  return pctVsMa >= 0 ? 'Above 44 MA' : 'Below 44 MA'
}

function signalClassFromPct(pctVsMa: number): 'above' | 'below' {
  return pctVsMa >= 0 ? 'above' : 'below'
}

function ListSkeleton() {
  return (
    <div className='ws-skeleton-list' aria-hidden>
      <div className='ws-skeleton-line short' />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className='ws-skeleton-row'>
          <div className='ws-skeleton-copy'>
            <div className='ws-skeleton-line' />
            <div className='ws-skeleton-line muted' />
          </div>
          <div className='ws-skeleton-chip' />
        </div>
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className='ws-skeleton-detail' aria-hidden>
      <div className='ws-skeleton-panel'>
        <div className='ws-skeleton-line' />
        <div className='ws-skeleton-line muted' />
      </div>
      <div className='ws-skeleton-chart' />
      <div className='ws-skeleton-metrics'>
        <div className='ws-skeleton-metric' />
        <div className='ws-skeleton-metric' />
        <div className='ws-skeleton-metric' />
      </div>
    </div>
  )
}

export function WorkspaceScreen() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const commandInputRef = useRef<HTMLInputElement | null>(null)
  const searchBlurTimer = useRef<number | null>(null)
  const [search, setSearch] = useState(localStorage.getItem(WORKSPACE_STORAGE_KEYS.search) ?? '')
  const [stocks, setStocks] = useState<StockListItem[]>([])
  const [favorites, setFavorites] = useState<StockListItem[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState('')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(localStorage.getItem(WORKSPACE_STORAGE_KEYS.selected) ?? null)
  const [detail, setDetail] = useState<StockDetail | null>(null)
  const [candles, setCandles] = useState<CandleItem[]>([])
  const [markers, setMarkers] = useState<ChartMarker[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editingCommentBody, setEditingCommentBody] = useState('')
  const [reorderBusyIndustry, setReorderBusyIndustry] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(WORKSPACE_STORAGE_KEYS.collapsed)
    if (!saved) {
      return {}
    }
    try {
      return JSON.parse(saved) as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const [dense, setDense] = useState(localStorage.getItem(WORKSPACE_STORAGE_KEYS.dense) === '1')
  const [syncBusy, setSyncBusy] = useState(false)
  const [bb, setBb] = useState(localStorage.getItem(WORKSPACE_STORAGE_KEYS.bb) === '1')
  const [rsi, setRsi] = useState(localStorage.getItem(WORKSPACE_STORAGE_KEYS.rsi) === '1')
  const [timeframe, setTimeframe] = useState<Timeframe>((localStorage.getItem(WORKSPACE_STORAGE_KEYS.timeframe) as Timeframe) || 'D')
  const [collapseAll, setCollapseAll] = useState(localStorage.getItem(WORKSPACE_STORAGE_KEYS.collapseAll) === '1')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [searchFocus, setSearchFocus] = useState(false)

  const filter = useMemo<FilterKey>(() => {
    const stored = localStorage.getItem(WORKSPACE_STORAGE_KEYS.filter)
    const key = (params.get('filter') ?? stored ?? 'all') as FilterKey
    if (key === 'ma' || key === 'watch' || key === 'fav') {
      return key
    }
    return 'all'
  }, [params])

  const loadFavorites = async () => {
    try {
      const payload = await getStocks('fav', '')
      setFavorites(payload)
    } catch {
      setFavorites([])
    }
  }

  const loadStocks = async () => {
    setLoadingList(true)
    setListError((prev) => (prev.startsWith('Could not save order') ? prev : ''))
    try {
      const payload = await getStocks(filter, search)
      setStocks(payload)

      if (payload.length && !selectedSymbol) {
        setSelectedSymbol(payload[0].symbol)
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load workspace stocks.')
      setStocks([])
    } finally {
      setLoadingList(false)
    }
  }

  const loadDetail = async (symbol: string) => {
    setLoadingDetail(true)
    setDetailError('')
    try {
      const [detailPayload, candlePayload] = await Promise.all([
        getStockDetail(symbol),
        getStockCandles(symbol, timeframe, ['ma44', bb ? 'bb' : '', rsi ? 'rsi' : ''].filter(Boolean).join(',')),
      ])
      setDetail(detailPayload)
      setCandles(candlePayload.bars)
      setMarkers(candlePayload.markers ?? [])
      localStorage.setItem(WORKSPACE_STORAGE_KEYS.selected, symbol)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load stock detail.')
      setDetail(null)
      setCandles([])
      setMarkers([])
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const timer = window.setTimeout(() => {
      void (async () => {
        setLoadingList(true)
        setListError((prev) => (prev.startsWith('Could not save order') ? prev : ''))
        try {
          const payload = await getStocks(filter, search)
          if (cancelled) {
            return
          }
          setStocks(payload)

          if (!payload.length) {
            setSelectedSymbol((current) => current)
          } else {
            setSelectedSymbol((current) => {
              // Keep the current/persisted selection even if it is filtered out of
              // the sidebar, so reload restores the exact previous view (S3).
              if (current) {
                return current
              }
              return payload[0].symbol
            })
          }
        } catch (err) {
          if (cancelled) {
            return
          }
          setListError(err instanceof Error ? err.message : 'Failed to load workspace stocks.')
          setStocks([])
        } finally {
          if (!cancelled) {
            setLoadingList(false)
          }
        }
      })()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [filter, search])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const payload = await getStocks('fav', '')
          if (!cancelled) {
            setFavorites(payload)
          }
        } catch {
          if (!cancelled) {
            setFavorites([])
          }
        }
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!selectedSymbol) {
      return
    }

    let cancelled = false

    const timer = window.setTimeout(() => {
      void (async () => {
        setLoadingDetail(true)
        setDetailError('')
        try {
          const [detailPayload, candlePayload] = await Promise.all([
            getStockDetail(selectedSymbol),
            getStockCandles(
              selectedSymbol,
              timeframe,
              ['ma44', bb ? 'bb' : '', rsi ? 'rsi' : ''].filter(Boolean).join(','),
            ),
          ])
          if (cancelled) {
            return
          }
          setDetail(detailPayload)
          setCandles(candlePayload.bars)
          setMarkers(candlePayload.markers ?? [])
          localStorage.setItem(WORKSPACE_STORAGE_KEYS.selected, selectedSymbol)
        } catch (err) {
          if (cancelled) {
            return
          }
          setDetailError(err instanceof Error ? err.message : 'Failed to load stock detail.')
          setDetail(null)
          setCandles([])
          setMarkers([])
        } finally {
          if (!cancelled) {
            setLoadingDetail(false)
          }
        }
      })()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [selectedSymbol, timeframe, bb, rsi])

  useEffect(() => {
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.search, search)
  }, [search])

  useEffect(() => {
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.filter, filter)
  }, [filter])

  useEffect(() => {
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.collapseAll, collapseAll ? '1' : '0')
  }, [collapseAll])

  useEffect(() => {
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.collapsed, JSON.stringify(collapsed))
  }, [collapsed])

  useEffect(() => {
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.dense, dense ? '1' : '0')
  }, [dense])

  useEffect(() => {
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.bb, bb ? '1' : '0')
  }, [bb])

  useEffect(() => {
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.rsi, rsi ? '1' : '0')
  }, [rsi])

  useEffect(() => {
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.timeframe, timeframe)
  }, [timeframe])

  useEffect(() => {
    if (selectedSymbol) {
      localStorage.setItem(WORKSPACE_STORAGE_KEYS.selected, selectedSymbol)
    } else {
      localStorage.removeItem(WORKSPACE_STORAGE_KEYS.selected)
    }
  }, [selectedSymbol])

  const grouped = useMemo(() => groupByIndustry(stocks), [stocks])
  const industryKeys = useMemo(() => Object.keys(grouped).sort((a, b) => a.localeCompare(b)), [grouped])
  const visibleSymbols = useMemo(
    () =>
      industryKeys.flatMap((industry) => {
        if (collapseAll || collapsed[industry] === true) {
          return [] as string[]
        }
        return grouped[industry].map((item) => item.symbol)
      }),
    [industryKeys, collapseAll, collapsed, grouped],
  )

  const universeEmpty = !loadingList && !listError && filter === 'all' && !search.trim() && stocks.length === 0
  const noMatches = !loadingList && !listError && !universeEmpty && stocks.length === 0
  const favDropdownOpen = searchFocus && !search.trim() && !universeEmpty

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const inTextInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((prev) => !prev)
        setPaletteQuery('')
        return
      }

      if (event.key === '/' && !inTextInput) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (event.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false)
        setPaletteQuery('')
        return
      }

      if (event.key === 'Escape' && selectedSymbol) {
        setSelectedSymbol(null)
        return
      }

      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !inTextInput && visibleSymbols.length > 0) {
        event.preventDefault()
        const current = selectedSymbol ? visibleSymbols.indexOf(selectedSymbol) : -1
        const delta = event.key === 'ArrowDown' ? 1 : -1
        let next = current + delta
        if (current === -1) {
          next = 0
        }
        next = Math.max(0, Math.min(visibleSymbols.length - 1, next))
        setSelectedSymbol(visibleSymbols[next])
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paletteOpen, selectedSymbol, visibleSymbols])

  useEffect(() => {
    if (!paletteOpen) {
      return
    }
    const timer = window.setTimeout(() => commandInputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [paletteOpen])

  useEffect(() => {
    return () => {
      if (searchBlurTimer.current) {
        window.clearTimeout(searchBlurTimer.current)
      }
    }
  }, [])

  const toggleStockFavorite = async (symbol: string) => {
    await toggleFavorite(symbol)
    await Promise.all([loadStocks(), loadFavorites()])
    if (selectedSymbol === symbol) {
      await loadDetail(symbol)
    }
  }

  const toggleStockWatch = async (symbol: string) => {
    await toggleWatch(symbol)
    await loadStocks()
    if (selectedSymbol === symbol) {
      await loadDetail(symbol)
    }
  }

  const onQuickSync = async () => {
    setSyncBusy(true)
    try {
      await startSync('incremental', 'watchlist')
    } finally {
      setSyncBusy(false)
    }
  }

  const changeFilter = (next: FilterKey) => {
    setParams({ filter: next })
  }

  const onMoveStock = async (industry: string, symbol: string, direction: -1 | 1) => {
    const rows = grouped[industry] ?? []
    const currentIndex = rows.findIndex((row) => row.symbol === symbol)
    const nextIndex = currentIndex + direction

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= rows.length || reorderBusyIndustry) {
      return
    }

    const reorderedRows = [...rows]
    const [moved] = reorderedRows.splice(currentIndex, 1)
    reorderedRows.splice(nextIndex, 0, moved)

    const otherStocks = stocks.filter((item) => item.industry !== industry)
    const regrouped = groupByIndustry(otherStocks)
    regrouped[industry] = reorderedRows
    const rebuiltStocks = industryKeys.flatMap((key) => regrouped[key] ?? [])

    const previousStocks = stocks
    setStocks(rebuiltStocks)
    setReorderBusyIndustry(industry)
    setListError((prev) => (prev.startsWith('Could not save order') ? '' : prev))

    try {
      await reorderStocks(
        industry,
        reorderedRows.map((row) => row.symbol),
      )
    } catch (err) {
      setStocks(previousStocks)
      setListError(err instanceof Error ? `Could not save order: ${err.message}` : 'Could not save order.')
    } finally {
      setReorderBusyIndustry(null)
    }
  }

  const paletteItems = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase()
    const stockMatches = stocks
      .filter((stock) => {
        if (!q) {
          return true
        }
        return [stock.symbol, stock.company, stock.industry].some((value) => value.toLowerCase().includes(q))
      })
      .slice(0, 8)
      .map((stock) => ({
        id: `stock-${stock.symbol}`,
        label: `${stock.symbol} · ${stock.company}`,
        meta: stock.industry,
        action: () => {
          setSelectedSymbol(stock.symbol)
          setPaletteOpen(false)
          setPaletteQuery('')
        },
      }))

    const filterItems: Array<{ id: string; label: string; meta: string; action: () => void }> = [
      { id: 'filter-all', label: 'Show all stocks', meta: 'Filter', action: () => setParams({ filter: 'all' }) },
      { id: 'filter-ma', label: 'Show stocks above 44 MA', meta: 'Filter', action: () => setParams({ filter: 'ma' }) },
      { id: 'filter-fav', label: 'Show favorites', meta: 'Filter', action: () => setParams({ filter: 'fav' }) },
      { id: 'filter-watch', label: 'Show watchlist', meta: 'Filter', action: () => setParams({ filter: 'watch' }) },
      {
        id: 'toggle-density',
        label: dense ? 'Switch to comfortable density' : 'Switch to dense mode',
        meta: 'View',
        action: () => setDense((prev) => !prev),
      },
      {
        id: 'toggle-collapse',
        label: collapseAll ? 'Expand all industry groups' : 'Collapse all industry groups',
        meta: 'View',
        action: () => setCollapseAll((prev) => !prev),
      },
    ]

    const screenTargets: Array<{ id: string; label: string; route: string }> = [
      { id: 'screen-sector', label: 'Sector analysis', route: '/sector' },
      { id: 'screen-trends', label: 'Weekly sector trends', route: '/trends' },
      { id: 'screen-journal', label: 'Trading journal', route: '/journal' },
      { id: 'screen-list', label: 'Stock list', route: '/list' },
      { id: 'screen-library', label: 'Library · reader', route: '/library' },
      { id: 'screen-admin', label: 'Admin', route: '/admin' },
      { id: 'screen-settings', label: 'Settings', route: '/settings' },
    ]
    const screenItems = screenTargets
      .filter((screen) => !q || screen.label.toLowerCase().includes(q))
      .map((screen) => ({
        id: screen.id,
        label: `Go to ${screen.label}`,
        meta: 'Screen',
        action: () => {
          navigate(screen.route)
          setPaletteOpen(false)
          setPaletteQuery('')
        },
      }))

    return [...filterItems, ...screenItems, ...stockMatches].slice(0, 9)
  }, [collapseAll, dense, navigate, paletteQuery, setParams, stocks])

  const onAddComment = async () => {
    if (!selectedSymbol || !commentDraft.trim()) {
      return
    }

    await addComment(selectedSymbol, commentDraft)
    setCommentDraft('')
    await loadDetail(selectedSymbol)
  }

  const onSaveCommentEdit = async () => {
    if (!selectedSymbol || editingCommentId === null || !editingCommentBody.trim()) {
      return
    }
    await updateComment(selectedSymbol, editingCommentId, editingCommentBody)
    setEditingCommentId(null)
    setEditingCommentBody('')
    await loadDetail(selectedSymbol)
  }

  const highlightLegend = useMemo(() => {
    if (timeframe !== 'D') {
      return [] as ChartMarker[]
    }
    const dates = new Set(candles.map((bar) => bar.date))
    return markers.filter((marker) => marker.kind === 'highlight' && dates.has(marker.date))
  }, [candles, markers, timeframe])

  return (
    <section className='screen ws-screen'>
      <div className='ws-layout'>
        <aside className='ws-sidebar'>
          <div className='ws-sidebar-head'>
            <div className='ws-brand-wrap'>
              <div className='ws-brand'>PaRo</div>
              <div className='ws-caption'>Nifty 200 review</div>
            </div>
            <div className='ws-head-actions'>
              <button className='ws-icon-btn' title='Command palette (Ctrl/Cmd+K)' onClick={() => setPaletteOpen(true)}>
                <Command size={14} />
              </button>
              <button
                className={`ws-icon-btn ${dense ? 'active' : ''}`}
                title='Toggle density'
                onClick={() => setDense((prev) => !prev)}
              >
                <Rows3 size={13} />
              </button>

              <button className='ws-collapse-btn' onClick={() => setCollapseAll((prev) => !prev)} title='Collapse all groups'>
                {collapseAll ? 'Expand all' : 'Collapse all'}
              </button>

              <button className='ws-quick-btn' disabled={syncBusy} onClick={() => void onQuickSync()}>
                <RefreshCw size={13} />
                {syncBusy ? 'Syncing...' : 'Quick sync'}
              </button>
            </div>
          </div>

          <div className='ws-search-shell'>
            <div className='ws-search-wrap'>
              <Search size={14} />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => {
                  if (searchBlurTimer.current) {
                    window.clearTimeout(searchBlurTimer.current)
                  }
                  setSearchFocus(true)
                  void loadFavorites()
                }}
                onClick={() => setSearchFocus(true)}
                onBlur={() => {
                  searchBlurTimer.current = window.setTimeout(() => setSearchFocus(false), 160)
                }}
                placeholder='Search symbol, company, or industry'
              />
            </div>

            {favDropdownOpen ? (
              <div className='ws-fav-dropdown'>
                <div className='ws-fav-dropdown-head'>
                  <Star size={12} />
                  Favorites
                </div>
                {favorites.length === 0 ? (
                  <div className='ws-fav-empty'>No favorites yet. Tap the star on a stock to add it here.</div>
                ) : (
                  favorites.map((fav) => (
                    <button
                      key={fav.symbol}
                      type='button'
                      className='ws-fav-item'
                      onMouseDown={(event) => {
                        event.preventDefault()
                        setSelectedSymbol(fav.symbol)
                        setSearchFocus(false)
                      }}
                    >
                      <Star size={13} />
                      <strong>{fav.symbol}</strong>
                      <span>{fav.company}</span>
                      <em className={fav.pct_vs_ma44 >= 0 ? 'up' : 'down'}>
                        {fav.pct_vs_ma44 >= 0 ? '+' : ''}
                        {fav.pct_vs_ma44.toFixed(2)}%
                      </em>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className='ws-chips'>
            {(['all', 'ma', 'fav', 'watch'] as FilterKey[]).map((chip) => (
              <button key={chip} type='button' className={`ws-chip ${chip === filter ? 'active' : ''}`} onClick={() => changeFilter(chip)}>
                {chip === 'all' ? 'All' : chip === 'ma' ? '44 MA' : chip === 'fav' ? 'Favorites' : 'Watchlist'}
              </button>
            ))}
          </div>

          <div className='ws-list'>
            {loadingList ? <ListSkeleton /> : null}
            {listError ? <div className='ws-empty ws-error'>{listError}</div> : null}
            {universeEmpty ? (
              <div className='ws-universe-empty'>
                <div className='ws-universe-empty-icon'>
                  <Database size={22} />
                </div>
                <div className='ws-universe-empty-title'>No stock universe</div>
                <div className='ws-universe-empty-copy'>
                  Upload a Nifty 200 stock list in Admin to populate the workspace, sectors, and trends.
                </div>
              </div>
            ) : null}
            {noMatches ? <div className='ws-empty'>No matching stocks.</div> : null}

            {!loadingList && !listError
              ? industryKeys.map((industry) => {
                  const rows = grouped[industry]
                  const open = !collapseAll && collapsed[industry] !== true
                  const aboveCount = rows.filter((row) => row.above_ma44).length
                  const pctAbove = rows.length ? Math.round((aboveCount / rows.length) * 100) : 0
                  const industryBusy = reorderBusyIndustry === industry
                  return (
                    <div key={industry} className='ws-group'>
                      <button
                        type='button'
                        className='ws-group-head'
                        onClick={() => setCollapsed((prev) => ({ ...prev, [industry]: !open }))}
                      >
                        <div className='ws-group-left'>
                          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                          <strong>{industry}</strong>
                        </div>
                        <div className='ws-group-right'>
                          <span>
                            {aboveCount}/{rows.length} above
                          </span>
                          <span className='ws-group-pill'>{pctAbove}% above</span>
                        </div>
                      </button>

                      {open
                        ? rows.map((stock) => (
                            <div
                              key={stock.symbol}
                              className={`ws-row ${selectedSymbol === stock.symbol ? 'active' : ''} ${dense ? 'dense' : ''}`}
                              onClick={() => setSelectedSymbol(stock.symbol)}
                            >
                              <div className='ws-row-top'>
                                <div>
                                  <div className='ws-row-symbol'>
                                    {stock.symbol}
                                    <span className={`ws-row-badge ${stock.above_ma44 ? 'above' : 'below'}`}>
                                      {stock.above_ma44 ? 'Above 44 MA' : 'Below 44 MA'}
                                    </span>
                                    <span className={`ws-row-sync-chip ${syncStateFromDate(stock.last_sync)}`}>
                                      {syncStateFromDate(stock.last_sync) === 'synced' ? 'Synced' : 'Stale'}
                                    </span>
                                  </div>
                                  <div className='ws-row-company'>
                                    {stock.company} · synced {stock.last_sync}
                                  </div>
                                </div>
                                <div className='ws-row-right'>
                                  <div className={`ws-row-pct ${stock.pct_vs_ma44 >= 0 ? 'up' : 'down'}`}>
                                    {stock.pct_vs_ma44 >= 0 ? '+' : ''}
                                    {stock.pct_vs_ma44.toFixed(2)}%
                                  </div>
                                  <div className='ws-row-ma'>MA44 {stock.ma44 ? stock.ma44.toFixed(1) : '-'}</div>
                                </div>
                              </div>

                              {!dense ? (
                                <div className='ws-row-actions'>
                                  <button
                                    type='button'
                                    title='Favorite'
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void toggleStockFavorite(stock.symbol)
                                    }}
                                    className={stock.is_favorite ? 'active' : ''}
                                  >
                                    <Star size={13} />
                                  </button>
                                  <button
                                    type='button'
                                    title='Watchlist'
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void toggleStockWatch(stock.symbol)
                                    }}
                                    className={stock.is_watchlist ? 'active' : ''}
                                  >
                                    <Bookmark size={13} />
                                  </button>
                                  <button
                                    type='button'
                                    title='Sync stock'
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void syncOne(stock.symbol)
                                    }}
                                  >
                                    <RefreshCw size={13} />
                                  </button>
                                  <button
                                    type='button'
                                    title='External chart'
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      window.open(`https://finance.yahoo.com/quote/${stock.yahoo_symbol}`, '_blank', 'noopener,noreferrer')
                                    }}
                                  >
                                    <ExternalLink size={13} />
                                  </button>

                                  <div className='ws-row-spacer' />
                                  <button
                                    type='button'
                                    title='Move up'
                                    disabled={industryBusy || rows[0]?.symbol === stock.symbol}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void onMoveStock(industry, stock.symbol, -1)
                                    }}
                                  >
                                    <ChevronUp size={13} />
                                  </button>
                                  <button
                                    type='button'
                                    title='Move down'
                                    disabled={industryBusy || rows[rows.length - 1]?.symbol === stock.symbol}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void onMoveStock(industry, stock.symbol, 1)
                                    }}
                                  >
                                    <ChevronDown size={13} />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))
                        : null}
                    </div>
                  )
                })
              : null}
          </div>
        </aside>

        <div className='ws-panel'>
          {!selectedSymbol ? (
            <div className='ws-empty-state'>
              {universeEmpty ? 'Upload a universe in Admin to start reviewing stocks.' : 'No stock selected.'}
            </div>
          ) : loadingDetail ? (
            <DetailSkeleton />
          ) : detailError ? (
            <div className='ws-empty-state ws-error'>{detailError}</div>
          ) : detail ? (
            <>
              <div className='ws-selected-card'>
                <div className='ws-selected-left'>
                  <div>
                    <div className='ws-selected-kicker'>Selected stock</div>
                    <div className='ws-selected-title'>{detail.company}</div>
                    <div className='ws-selected-meta'>
                      {detail.symbol} · {detail.industry}
                    </div>
                  </div>

                  <div className={`ws-signal-card ${signalClassFromPct(detail.pct_vs_ma44)}`}>
                    <span>Signal</span>
                    <strong>
                      {detail.pct_vs_ma44 >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      {signalLabelFromPct(detail.pct_vs_ma44)}
                    </strong>
                  </div>
                </div>

                <button className='ws-icon-btn' onClick={() => setSelectedSymbol(null)}>
                  <X size={14} />
                </button>
              </div>

              <div className='ws-card'>
                <div className='ws-card-head'>
                  <div className='ws-card-title-wrap'>
                    <div className='ws-card-title'>Price Timeline</div>
                    <span className='ws-timeframe-pill'>
                      {timeframe === 'D' ? 'Daily' : timeframe === 'W' ? 'Weekly' : 'Monthly'} · {candles.length} bars
                    </span>
                  </div>

                  <div className='ws-timeframe'>
                    {(
                      [
                        ['D', 'Daily'],
                        ['W', 'Weekly'],
                        ['M', 'Monthly'],
                      ] as const
                    ).map(([tf, label]) => (
                      <button key={tf} className={timeframe === tf ? 'active' : ''} onClick={() => setTimeframe(tf)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className='ws-toggles'>
                    <button className={bb ? 'active' : ''} onClick={() => setBb((prev) => !prev)}>
                      <Square size={11} /> Bollinger
                    </button>
                    <button className={rsi ? 'active' : ''} onClick={() => setRsi((prev) => !prev)}>
                      <span className='ws-minus-icon' /> RSI
                    </button>
                  </div>
                </div>

                <div className='ws-line-legend'>
                  <span>
                    <i className='l1' />
                    44-period MA
                  </span>
                  <span>
                    <i className='l2' />
                    Bollinger (20, 2)
                  </span>
                  <span>
                    <i className='l3' />
                    RSI (14)
                  </span>
                  <span>
                    <i className='l4' />
                    Highlight
                  </span>
                  {highlightLegend.map((marker) => (
                    <span key={`${marker.date}-${marker.label}`}>
                      <i className='l4' style={{ background: marker.color || undefined }} />
                      {marker.label || marker.date}
                    </span>
                  ))}
                </div>

                <PriceChart bars={candles} markers={markers} showBollinger={bb} showRsi={rsi} timeframe={timeframe} />
              </div>

              <div className='ws-metrics'>
                <div className='ws-metric-card'>
                  <span>Close Price</span>
                  <strong>{detail.close.toFixed(2)}</strong>
                </div>
                <div className='ws-metric-card'>
                  <span>44 Day MA</span>
                  <strong>{detail.ma44 ? detail.ma44.toFixed(2) : '-'}</strong>
                </div>
                <div className='ws-metric-card'>
                  <span>% Above MA</span>
                  <strong className={detail.pct_vs_ma44 >= 0 ? 'up' : 'down'}>
                    {detail.pct_vs_ma44 >= 0 ? '+' : ''}
                    {detail.pct_vs_ma44.toFixed(2)}%
                  </strong>
                </div>
              </div>

              <div className='ws-meta-grid'>
                <div className='ws-card ws-meta-card'>
                  <div className='ws-meta-title'>Identifiers</div>
                  <div className='ws-meta-list'>
                    <div>
                      <span>Yahoo</span>
                      <strong>{detail.yahoo_symbol}</strong>
                    </div>
                    <div>
                      <span>Series</span>
                      <strong>{detail.series}</strong>
                    </div>
                    <div>
                      <span>ISIN</span>
                      <strong>{detail.isin}</strong>
                    </div>
                  </div>
                </div>

                <div className='ws-card ws-meta-card'>
                  <div className='ws-meta-title'>Data Freshness</div>
                  <div className='ws-meta-list'>
                    <div>
                      <span>Updated</span>
                      <strong>{detail.last_sync}</strong>
                    </div>
                    <div>
                      <span>Sync status</span>
                      <strong>
                        <span className={`ws-row-sync-chip ${syncStateFromDate(detail.last_sync)}`}>
                          {syncStateFromDate(detail.last_sync) === 'synced' ? 'Synced' : 'Stale'}
                        </span>
                      </strong>
                    </div>
                    <div>
                      <span>Favorite</span>
                      <strong>{detail.is_favorite ? 'Yes' : 'No'}</strong>
                    </div>
                    <div>
                      <span>Watchlist</span>
                      <strong>{detail.is_watchlist ? 'Yes' : 'No'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className='ws-card'>
                <div className='ws-card-head'>
                  <div className='ws-card-title'>Comments</div>
                </div>
                <div className='ws-comment-box'>
                  <MessageSquare size={14} />
                  <textarea
                    placeholder='Add a note about this stock...'
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                  />
                </div>
                <div className='ws-comment-actions'>
                  <button onClick={() => void onAddComment()} disabled={!commentDraft.trim()}>
                    Add comment
                  </button>
                </div>
                <div className='ws-comment-list'>
                  {detail.comments.length === 0 ? <div className='ws-empty'>No comments yet.</div> : null}
                  {detail.comments.map((comment) => (
                    <div key={comment.id} className='ws-comment-item'>
                      {editingCommentId === comment.id ? (
                        <div className='ws-comment-edit'>
                          <textarea value={editingCommentBody} onChange={(event) => setEditingCommentBody(event.target.value)} />
                          <div className='ws-comment-edit-actions'>
                            <button type='button' onClick={() => void onSaveCommentEdit()} disabled={!editingCommentBody.trim()}>
                              Save
                            </button>
                            <button
                              type='button'
                              onClick={() => {
                                setEditingCommentId(null)
                                setEditingCommentBody('')
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>{comment.body}</div>
                          <div className='ws-comment-item-actions'>
                            <button
                              type='button'
                              onClick={() => {
                                setEditingCommentId(comment.id)
                                setEditingCommentBody(comment.body)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type='button'
                              onClick={() => {
                                if (!selectedSymbol) {
                                  return
                                }
                                void deleteComment(selectedSymbol, comment.id).then(() => loadDetail(selectedSymbol))
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {paletteOpen ? (
        <div className='ws-command-backdrop' onClick={() => setPaletteOpen(false)}>
          <div className='ws-command-palette' onClick={(event) => event.stopPropagation()}>
            <div className='ws-command-head'>
              <Command size={15} />
              <input
                ref={commandInputRef}
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder='Jump to a stock, sector, or screen…'
              />
            </div>

            <div className='ws-command-list'>
              {paletteItems.map((item) => (
                <button
                  key={item.id}
                  type='button'
                  className='ws-command-item'
                  onClick={() => {
                    item.action()
                    setPaletteOpen(false)
                    setPaletteQuery('')
                  }}
                >
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.meta}</span>
                  </div>
                  <Check size={14} />
                </button>
              ))}
              {paletteItems.length === 0 ? <div className='ws-command-empty'>No matching actions.</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
