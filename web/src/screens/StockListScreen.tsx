import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Columns3,
  Eye,
  EyeOff,
  Filter,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from 'lucide-react'
import {
  createStockListColumn,
  deleteStockListColumn,
  getStockList,
  patchStockListRow,
  reorderStockListColumns,
  type ColumnType,
  type ScreenLabel,
  type StockListColumn,
  type StockListRow,
  updateStockListColumn,
} from '../api/stockList'

type SortDir = 'asc' | 'desc'
type EditState = { symbol: string; field: string; value: string }

const STORAGE_KEYS = {
  sortBy: 'list:sortBy',
  sortDir: 'list:sortDir',
  groupBy: 'list:groupBy',
  filters: 'list:filters',
  search: 'list:search',
  closed: 'list:closed',
  limit: 'list:limit',
  colOrder: 'list:colOrder',
  colHidden: 'list:colHidden',
} as const

const PAGE_SIZE = 8

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) {
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function cellValue(row: StockListRow, key: string): string | boolean | number {
  if (key === 'symbol') return row.symbol
  if (key === 'company') return row.company
  if (key === 'industry') return row.industry
  if (key === 'subcategory') return row.subcategory
  if (key === 'notes') return row.notes
  if (key === 'screen') return row.screen
  if (key === 'ma_d') return row.ma_d.above
  if (key === 'ma_w') return row.ma_w.above
  if (key === 'ma_m') return row.ma_m.above
  const custom = row.custom[key]
  if (custom === undefined || custom === null) return ''
  return custom
}

function displayValue(row: StockListRow, column: StockListColumn): string {
  const value = cellValue(row, column.key)
  if (column.type === 'signal20') {
    return value ? 'Above' : 'Below'
  }
  if (column.type === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return value === '' || value === null || value === undefined ? '' : String(value)
}

function screenClass(screen: ScreenLabel): string {
  if (screen === 'Strong buy' || screen === 'Buy') return 'buy'
  if (screen === 'Watch') return 'watch'
  if (screen === 'Avoid') return 'avoid'
  return 'hold'
}

function patchFieldForColumn(column: StockListColumn): string {
  if (column.builtin) {
    if (column.key === 'ma_d') return 'ma_d_override'
    if (column.key === 'ma_w') return 'ma_w_override'
    if (column.key === 'ma_m') return 'ma_m_override'
    return column.key
  }
  return `custom:${column.key}`
}

function isEditable(column: StockListColumn): boolean {
  if (!column.builtin) return true
  return ['subcategory', 'notes', 'screen', 'ma_d', 'ma_w', 'ma_m'].includes(column.key)
}

export function StockListScreen() {
  const [rows, setRows] = useState<StockListRow[]>([])
  const [columns, setColumns] = useState<StockListColumn[]>([])
  const [screenOptions, setScreenOptions] = useState<ScreenLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState(localStorage.getItem(STORAGE_KEYS.search) ?? '')
  const [sortBy, setSortBy] = useState(localStorage.getItem(STORAGE_KEYS.sortBy) ?? 'symbol')
  const [sortDir, setSortDir] = useState<SortDir>((localStorage.getItem(STORAGE_KEYS.sortDir) as SortDir) || 'asc')
  const [groupBy, setGroupBy] = useState(localStorage.getItem(STORAGE_KEYS.groupBy) ?? 'industry')
  const [filters, setFilters] = useState<Record<string, string[]>>(() => readJson(STORAGE_KEYS.filters, {}))
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>(() => readJson(STORAGE_KEYS.closed, {}))
  const [pageLimit, setPageLimit] = useState(Number(localStorage.getItem(STORAGE_KEYS.limit) || PAGE_SIZE))
  const [colOrder, setColOrder] = useState<string[]>(() => readJson<string[]>(STORAGE_KEYS.colOrder, []))
  const [hiddenKeys, setHiddenKeys] = useState<string[]>(() => readJson<string[]>(STORAGE_KEYS.colHidden, []))
  const [edit, setEdit] = useState<EditState | null>(null)
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null)
  const [filterMenu, setFilterMenu] = useState<{ key: string; x: number; y: number } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<ColumnType>('text')
  const [newOptions, setNewOptions] = useState('')
  const [dragKey, setDragKey] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current)
    }
    toastTimer.current = window.setTimeout(() => setToast(''), 1900)
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await getStockList()
      setRows(payload.rows)
      setColumns(payload.columns)
      setScreenOptions(payload.screen_options)
      const keys = payload.columns.map((column) => column.key)
      setColOrder((prev) => {
        const kept = prev.filter((key) => keys.includes(key))
        const added = keys.filter((key) => !kept.includes(key))
        return [...kept, ...added]
      })
      const serverHidden = payload.columns.filter((column) => column.hidden).map((column) => column.key)
      setHiddenKeys((prev) => Array.from(new Set([...prev, ...serverHidden])).filter((key) => keys.includes(key)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock list.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.search, search)
  }, [search])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sortBy, sortBy)
  }, [sortBy])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sortDir, sortDir)
  }, [sortDir])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.groupBy, groupBy)
  }, [groupBy])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters))
  }, [filters])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.closed, JSON.stringify(closedGroups))
  }, [closedGroups])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.limit, String(pageLimit))
  }, [pageLimit])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.colOrder, JSON.stringify(colOrder))
  }, [colOrder])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.colHidden, JSON.stringify(hiddenKeys))
  }, [hiddenKeys])

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current)
      }
    }
  }, [])

  const orderedColumns = useMemo(() => {
    if (!colOrder.length) {
      return columns
    }
    const byKey = new Map(columns.map((column) => [column.key, column]))
    const ordered = colOrder
      .map((key) => byKey.get(key))
      .filter((column): column is StockListColumn => Boolean(column))
    const rest = columns.filter((column) => !colOrder.includes(column.key))
    return [...ordered, ...rest]
  }, [columns, colOrder])

  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => !hiddenKeys.includes(column.key)),
    [orderedColumns, hiddenKeys],
  )

  const filteredRows = useMemo(() => {
    let next = rows.slice()
    const q = search.trim().toLowerCase()
    if (q) {
      next = next.filter((row) =>
        visibleColumns.some((column) => displayValue(row, column).toLowerCase().includes(q)),
      )
    }
    Object.entries(filters).forEach(([key, values]) => {
      if (!values.length) {
        return
      }
      const column = columns.find((item) => item.key === key)
      if (!column) {
        return
      }
      next = next.filter((row) => values.includes(displayValue(row, column)))
    })

    const sortColumn = columns.find((column) => column.key === sortBy)
    if (sortColumn) {
      const dir = sortDir === 'desc' ? -1 : 1
      next.sort((a, b) => {
        const left = cellValue(a, sortColumn.key)
        const right = cellValue(b, sortColumn.key)
        if (typeof left === 'boolean' && typeof right === 'boolean') {
          return (Number(left) - Number(right)) * dir
        }
        if (typeof left === 'number' && typeof right === 'number') {
          return (left - right) * dir
        }
        return String(left).localeCompare(String(right)) * dir
      })
    }
    return next
  }, [columns, filters, rows, search, sortBy, sortDir, visibleColumns])

  const groups = useMemo(() => {
    if (!groupBy || groupBy === 'none') {
      return [{ key: 'all', label: '', rows: filteredRows.slice(0, pageLimit * 4), total: filteredRows.length }]
    }
    const map = new Map<string, StockListRow[]>()
    filteredRows.forEach((row) => {
      const label = String(cellValue(row, groupBy) || '—')
      const bucket = map.get(label) ?? []
      bucket.push(row)
      map.set(label, bucket)
    })
    const perGroup = Math.max(3, Math.round(pageLimit / Math.max(1, map.size)))
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, groupRows]) => ({
        key: label,
        label,
        rows: groupRows.slice(0, perGroup),
        total: groupRows.length,
      }))
  }, [filteredRows, groupBy, pageLimit])

  const replaceRow = (next: StockListRow) => {
    setRows((prev) => prev.map((row) => (row.symbol === next.symbol ? next : row)))
  }

  const saveEdit = async () => {
    if (!edit) {
      return
    }
    const column = columns.find((item) => item.key === edit.field || `custom:${item.key}` === edit.field)
    const field = column ? patchFieldForColumn(column) : edit.field
    let value: string | boolean | null = edit.value
    if (column?.type === 'signal20') {
      if (edit.value === '') {
        value = null
      } else {
        value = edit.value === 'Above' || edit.value === 'true'
      }
    }
    if (column?.key === 'screen' && edit.value === '__auto__') {
      value = null
    }
    try {
      const updated = await patchStockListRow(edit.symbol, field, value)
      replaceRow(updated)
      setEdit(null)
      showToast('Saved')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const onCreateColumn = async () => {
    const label = newLabel.trim()
    if (!label) {
      return
    }
    const options =
      newType === 'choice'
        ? newOptions
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : []
    try {
      const created = await createStockListColumn({ label, type: newType, options })
      setColumns((prev) => [...prev, created])
      setAddOpen(false)
      setNewLabel('')
      setNewOptions('')
      setNewType('text')
      showToast(`Column "${created.label}" added`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add column')
    }
  }

  const onHideColumn = async (column: StockListColumn) => {
    setHiddenKeys((prev) => (prev.includes(column.key) ? prev : [...prev, column.key]))
    setMenu(null)
    if (!column.builtin) {
      try {
        const updated = await updateStockListColumn(column.id, { hidden: true })
        setColumns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      } catch {
        /* client hide still applies */
      }
    }
  }

  const onShowAllColumns = async () => {
    const hiddenCustom = columns.filter((column) => !column.builtin && hiddenKeys.includes(column.key))
    setHiddenKeys([])
    for (const column of hiddenCustom) {
      try {
        const updated = await updateStockListColumn(column.id, { hidden: false })
        setColumns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      } catch {
        /* client show still applies */
      }
    }
  }

  const onDeleteColumn = async (column: StockListColumn) => {
    if (column.builtin) {
      return
    }
    await deleteStockListColumn(column.id)
    setColumns((prev) => prev.filter((item) => item.id !== column.id))
    setMenu(null)
    showToast('Column deleted')
  }

  const onDropColumn = async (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null)
      return
    }
    const base = (colOrder.length ? colOrder : orderedColumns.map((column) => column.key)).slice()
    const from = base.indexOf(dragKey)
    const to = base.indexOf(targetKey)
    if (from < 0 || to < 0) {
      setDragKey(null)
      return
    }
    base.splice(from, 1)
    base.splice(to, 0, dragKey)
    setColOrder(base)
    setDragKey(null)
    showToast('Column moved')
    // Best-effort: keep the server's custom-column order consistent.
    const customOrder = base.filter((key) => columns.some((column) => column.key === key && !column.builtin))
    if (customOrder.length > 1) {
      try {
        await reorderStockListColumns(customOrder)
      } catch {
        /* client order persists via localStorage */
      }
    }
  }

  const hiddenCount = hiddenKeys.filter((key) => columns.some((column) => column.key === key)).length
  const activeFilterCount = Object.values(filters).filter((values) => values.length > 0).length

  return (
    <section className='screen list-screen'>
      <div className='list-toolbar'>
        <div>
          <h1 className='screen-title'>Stock list</h1>
          <p className='list-count'>
            {filteredRows.length} of {rows.length} stocks · {visibleColumns.length} columns
            {groupBy && groupBy !== 'none' ? ' · grouped' : ''}
          </p>
        </div>
        <div className='list-toolbar-actions'>
          <div className='list-search'>
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPageLimit(PAGE_SIZE)
              }}
              placeholder='Search list'
            />
          </div>
          {groupBy && groupBy !== 'none' ? (
            <button type='button' className='list-chip' onClick={() => setGroupBy('none')}>
              Grouped by {columns.find((column) => column.key === groupBy)?.label ?? groupBy}
              <X size={12} />
            </button>
          ) : null}
          {activeFilterCount > 0 ? (
            <button type='button' className='list-chip' onClick={() => setFilters({})}>
              Clear filters
            </button>
          ) : null}
          {hiddenCount > 0 ? (
            <button type='button' className='list-chip' onClick={() => void onShowAllColumns()}>
              <Eye size={12} /> Show {hiddenCount} hidden
            </button>
          ) : null}
          <button type='button' className='list-primary' onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add column
          </button>
        </div>
      </div>

      {loading ? <div className='list-empty'>Loading stock list...</div> : null}
      {error ? <div className='list-empty list-error'>{error}</div> : null}
      {!loading && !error && rows.length === 0 ? (
        <div className='list-empty'>No stock universe yet. Upload a list in Admin first.</div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className='list-grid-wrap'>
          <div className='list-grid' style={{ minWidth: `${120 + visibleColumns.reduce((sum, column) => sum + (column.key === 'notes' ? 220 : 140), 0)}px` }}>
            <div
              className='list-head'
              style={{ gridTemplateColumns: visibleColumns.map((column) => `${column.key === 'notes' ? 240 : column.key === 'company' ? 200 : 140}px`).join(' ') }}
            >
              {visibleColumns.map((column) => (
                <div
                  key={column.key}
                  className={`list-head-cell ${dragKey === column.key ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => setDragKey(column.key)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => void onDropColumn(column.key)}
                  onDragEnd={() => setDragKey(null)}
                >
                  <GripVertical size={12} />
                  <span>{column.label}</span>
                  {filters[column.key]?.length ? (
                    <Filter size={11} className='list-head-filtered' aria-label='Filtered' />
                  ) : null}
                  <button
                    type='button'
                    className='list-icon-btn'
                    title='Sort'
                    onClick={() => {
                      if (sortBy === column.key) {
                        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                      } else {
                        setSortBy(column.key)
                        setSortDir('asc')
                      }
                    }}
                  >
                    {sortBy === column.key ? sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <Columns3 size={12} />}
                  </button>
                  <button
                    type='button'
                    className='list-icon-btn'
                    title='Column menu'
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect()
                      setMenu({ key: column.key, x: Math.min(rect.left, window.innerWidth - 240), y: rect.bottom + 6 })
                      setFilterMenu(null)
                    }}
                  >
                    <MoreHorizontal size={13} />
                  </button>
                </div>
              ))}
            </div>

            {filteredRows.length === 0 ? <div className='list-empty'>No matching stocks.</div> : null}

            {groups.map((group) => {
              const open = !closedGroups[group.key]
              return (
                <div key={group.key} className='list-group'>
                  {group.label ? (
                    <button
                      type='button'
                      className='list-group-head'
                      onClick={() => setClosedGroups((prev) => ({ ...prev, [group.key]: open }))}
                    >
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <strong>{group.label}</strong>
                      <span>
                        {group.rows.length >= group.total
                          ? `${group.total} item${group.total === 1 ? '' : 's'}`
                          : `${group.rows.length} of ${group.total}`}
                      </span>
                    </button>
                  ) : null}

                  {open
                    ? group.rows.map((row) => (
                        <div
                          key={row.symbol}
                          className='list-row'
                          style={{ gridTemplateColumns: visibleColumns.map((column) => `${column.key === 'notes' ? 240 : column.key === 'company' ? 200 : 140}px`).join(' ') }}
                        >
                          {visibleColumns.map((column) => {
                            const editing = edit?.symbol === row.symbol && edit.field === column.key
                            const text = displayValue(row, column)
                            const editable = isEditable(column)

                            if (column.type === 'signal20') {
                              const state = column.key === 'ma_d' ? row.ma_d : column.key === 'ma_w' ? row.ma_w : row.ma_m
                              return (
                                <div key={column.key} className='list-cell'>
                                  {editing ? (
                                    <select
                                      autoFocus
                                      value={edit.value}
                                      onChange={(event) => setEdit({ ...edit, value: event.target.value })}
                                      onBlur={() => void saveEdit()}
                                    >
                                      <option value='Above'>Above</option>
                                      <option value='Below'>Below</option>
                                      <option value=''>Auto (clear override)</option>
                                    </select>
                                  ) : (
                                    <button
                                      type='button'
                                      className={`list-signal ${state.above ? 'above' : 'below'} ${state.overridden ? 'overridden' : ''}`}
                                      title={editable ? 'Click to override' : text}
                                      onClick={() =>
                                        setEdit({
                                          symbol: row.symbol,
                                          field: column.key,
                                          value: state.above ? 'Above' : 'Below',
                                        })
                                      }
                                    >
                                      {state.above ? 'Above' : 'Below'}
                                      {state.overridden ? ' · override' : ''}
                                    </button>
                                  )}
                                </div>
                              )
                            }

                            if (column.key === 'screen') {
                              return (
                                <div key={column.key} className='list-cell'>
                                  {editing ? (
                                    <select
                                      autoFocus
                                      value={edit.value}
                                      onChange={(event) => setEdit({ ...edit, value: event.target.value })}
                                      onBlur={() => void saveEdit()}
                                    >
                                      <option value='__auto__'>Auto · {row.screen_auto}</option>
                                      {screenOptions.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <button
                                      type='button'
                                      className={`list-screen-pill ${screenClass(row.screen)}`}
                                      onClick={() =>
                                        setEdit({
                                          symbol: row.symbol,
                                          field: 'screen',
                                          value: row.screen_overridden ? row.screen : '__auto__',
                                        })
                                      }
                                    >
                                      {row.screen}
                                      {row.screen_overridden ? ' · override' : ''}
                                    </button>
                                  )}
                                </div>
                              )
                            }

                            if (column.type === 'choice' && editable) {
                              return (
                                <div key={column.key} className='list-cell'>
                                  {editing ? (
                                    <select
                                      autoFocus
                                      value={edit.value}
                                      onChange={(event) => setEdit({ ...edit, value: event.target.value })}
                                      onBlur={() => void saveEdit()}
                                    >
                                      {(column.options.length ? column.options : [text]).map((option) => (
                                        <option key={option} value={option}>
                                          {option || '—'}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <button
                                      type='button'
                                      className='list-plain-edit'
                                      onClick={() => setEdit({ symbol: row.symbol, field: column.key, value: text })}
                                    >
                                      {text || '—'}
                                    </button>
                                  )}
                                </div>
                              )
                            }

                            return (
                              <div key={column.key} className={`list-cell ${column.key === 'symbol' ? 'symbol' : ''}`}>
                                {editing ? (
                                  <input
                                    autoFocus
                                    value={edit.value}
                                    onChange={(event) => setEdit({ ...edit, value: event.target.value })}
                                    onBlur={() => void saveEdit()}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault()
                                        void saveEdit()
                                      }
                                      if (event.key === 'Escape') {
                                        setEdit(null)
                                      }
                                    }}
                                  />
                                ) : editable ? (
                                  <button
                                    type='button'
                                    className='list-plain-edit'
                                    onClick={() => setEdit({ symbol: row.symbol, field: column.key, value: text })}
                                  >
                                    {text || <span className='list-placeholder'>Click to edit</span>}
                                  </button>
                                ) : (
                                  <span>{text || '—'}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ))
                    : null}
                </div>
              )
            })}
          </div>

          {filteredRows.length > groups.reduce((sum, group) => sum + group.rows.length, 0) ? (
            <button type='button' className='list-more' onClick={() => setPageLimit((prev) => prev + PAGE_SIZE)}>
              Show more · {filteredRows.length - groups.reduce((sum, group) => sum + group.rows.length, 0)} remaining
            </button>
          ) : null}
        </div>
      ) : null}

      {menu ? (
        <div className='list-menu-backdrop' onClick={() => setMenu(null)}>
          <div className='list-menu' style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
            {(() => {
              const column = columns.find((item) => item.key === menu.key)
              if (!column) {
                return null
              }
              return (
                <>
                  <button
                    type='button'
                    onClick={() => {
                      setSortBy(column.key)
                      setSortDir('asc')
                      setMenu(null)
                    }}
                  >
                    <ArrowUp size={13} /> Sort ascending
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setSortBy(column.key)
                      setSortDir('desc')
                      setMenu(null)
                    }}
                  >
                    <ArrowDown size={13} /> Sort descending
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setFilterMenu({ key: column.key, x: menu.x, y: menu.y })
                      setMenu(null)
                    }}
                  >
                    <Filter size={13} /> Filter by values
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setGroupBy((prev) => (prev === column.key ? 'none' : column.key))
                      setClosedGroups({})
                      setMenu(null)
                    }}
                  >
                    {groupBy === column.key ? 'Remove grouping' : 'Group by this column'}
                  </button>
                  <button type='button' onClick={() => void onHideColumn(column)}>
                    <EyeOff size={13} /> Hide column
                  </button>
                  {!column.builtin ? (
                    <button type='button' className='danger' onClick={() => void onDeleteColumn(column)}>
                      Delete column
                    </button>
                  ) : null}
                </>
              )
            })()}
          </div>
        </div>
      ) : null}

      {filterMenu ? (
        <div className='list-menu-backdrop' onClick={() => setFilterMenu(null)}>
          <div className='list-menu wide' style={{ left: filterMenu.x, top: filterMenu.y }} onClick={(event) => event.stopPropagation()}>
            {(() => {
              const column = columns.find((item) => item.key === filterMenu.key)
              if (!column) {
                return null
              }
              const counts = new Map<string, number>()
              rows.forEach((row) => {
                const label = displayValue(row, column)
                counts.set(label, (counts.get(label) ?? 0) + 1)
              })
              const active = filters[column.key] ?? []
              return (
                <>
                  <div className='list-menu-title'>Filter · {column.label}</div>
                  <button type='button' onClick={() => setFilters((prev) => ({ ...prev, [column.key]: [] }))}>
                    Clear
                  </button>
                  {Array.from(counts.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([label, count]) => (
                      <button
                        key={label || '(empty)'}
                        type='button'
                        onClick={() =>
                          setFilters((prev) => {
                            const current = prev[column.key] ?? []
                            const next = current.includes(label)
                              ? current.filter((item) => item !== label)
                              : [...current, label]
                            return { ...prev, [column.key]: next }
                          })
                        }
                      >
                        <span className={active.includes(label) ? 'checked' : ''}>{label || '(empty)'}</span>
                        <em>{count}</em>
                      </button>
                    ))}
                </>
              )
            })()}
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div className='list-menu-backdrop' onClick={() => setAddOpen(false)}>
          <div className='list-add-card' onClick={(event) => event.stopPropagation()}>
            <h2>Add column</h2>
            <label>
              Name
              <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder='Column name' />
            </label>
            <label>
              Type
              <select value={newType} onChange={(event) => setNewType(event.target.value as ColumnType)}>
                <option value='text'>Single line text</option>
                <option value='number'>Number</option>
                <option value='choice'>Choice</option>
                <option value='date'>Date</option>
                <option value='boolean'>Yes / No</option>
              </select>
            </label>
            {newType === 'choice' ? (
              <label>
                Options (comma separated)
                <input value={newOptions} onChange={(event) => setNewOptions(event.target.value)} placeholder='A, B, C' />
              </label>
            ) : null}
            <div className='list-add-actions'>
              <button type='button' className='list-primary' onClick={() => void onCreateColumn()}>
                Create
              </button>
              <button type='button' onClick={() => setAddOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className='list-toast'>{toast}</div> : null}
    </section>
  )
}
