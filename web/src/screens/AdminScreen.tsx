import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  RotateCw,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import {
  clearUniverse,
  getUniverse,
  getUniverseStatus,
  uploadUniverse,
  type UniverseStock,
  type UniverseUploadResponse,
} from '../api/universe'
import {
  getSyncRunDetail,
  getSyncRuns,
  getSyncStatus,
  retryFailed,
  startSync,
  type SyncRun,
  type SyncRunDetail,
} from '../api/sync'
import {
  createHighlight,
  deleteHighlight,
  listHighlights,
  updateHighlight,
  type ChartHighlight,
} from '../api/highlights'
import { BookIngestCard } from '../components/BookIngestCard'

type UploadIntent = 'append' | 'replace' | null

function formatTimestamp(value: string): string {
  const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`
  return new Date(normalized).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

function formatRunMode(mode: string, scope: string): string {
  const modeLabel = mode === 'full' ? 'Full' : 'Incremental'
  if (scope === 'watchlist') {
    return `${modeLabel} · Watchlist`
  }
  return modeLabel
}

export function AdminScreen() {
  const [file, setFile] = useState<File | null>(null)
  const [intent, setIntent] = useState<UploadIntent>(null)
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<UniverseUploadResponse | null>(null)
  const [currentCount, setCurrentCount] = useState(0)
  const [hasUniverse, setHasUniverse] = useState(false)
  const [universeRows, setUniverseRows] = useState<UniverseStock[]>([])
  const [lastUniverseUpdateAt, setLastUniverseUpdateAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [syncStatus, setSyncStatus] = useState<SyncRun | null>(null)
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [selectedRunDetail, setSelectedRunDetail] = useState<SyncRunDetail | null>(null)
  const [syncError, setSyncError] = useState<string>('')

  const [highlights, setHighlights] = useState<ChartHighlight[]>([])
  const [hlDate, setHlDate] = useState('')
  const [hlLabel, setHlLabel] = useState('')
  const [hlSymbol, setHlSymbol] = useState('')
  const [hlBusy, setHlBusy] = useState(false)
  const [hlError, setHlError] = useState('')
  const [hlEditId, setHlEditId] = useState<number | null>(null)
  const [hlEditLabel, setHlEditLabel] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const progressTimer = useRef<number | null>(null)

  const isSyncRunning = syncStatus?.status === 'running'

  const previewColor = useMemo(() => {
    const needle = hlLabel.trim().toLowerCase()
    if (!needle) return '#3C2CDA'
    const existing = highlights.find((item) => item.label.toLowerCase() === needle)
    if (existing) return existing.color
    const palette = ['#3C2CDA', '#EA9D00', '#14CBDE', '#1D86FF', '#12A053', '#DC3545', '#8B5CF6']
    const distinct = new Set(highlights.map((item) => item.label.toLowerCase()))
    return palette[distinct.size % palette.length]
  }, [highlights, hlLabel])

  const reuseNote = useMemo(() => {
    const needle = hlLabel.trim().toLowerCase()
    if (!needle) return ''
    const existing = highlights.find((item) => item.label.toLowerCase() === needle)
    return existing ? `Reusing color for “${existing.label}”.` : ''
  }, [highlights, hlLabel])

  const refreshHighlights = async () => {
    try {
      const rows = await listHighlights()
      setHighlights(rows)
      setHlError('')
    } catch (err) {
      setHlError(err instanceof Error ? err.message : 'Failed to load highlights.')
    }
  }

  const refreshUniverseState = () => {
    return Promise.all([getUniverse(), getUniverseStatus()])
      .then(([rows, status]) => {
        setUniverseRows(rows)
        setCurrentCount(status.active_stocks)
        setHasUniverse(status.active_stocks > 0)
        setLastUniverseUpdateAt(status.last_upload_at)
      })
      .catch(() => setError('Failed to load universe state.'))
  }

  const refreshSyncState = async (focusRunId?: number) => {
    try {
      const [statusPayload, runsPayload] = await Promise.all([getSyncStatus(), getSyncRuns()])
      setSyncStatus(statusPayload)
      setSyncRuns(runsPayload)

      const nextId = focusRunId ?? selectedRunId ?? runsPayload[0]?.id ?? null
      if (nextId !== null) {
        const detail = await getSyncRunDetail(nextId)
        setSelectedRunId(nextId)
        setSelectedRunDetail(detail)
      } else {
        setSelectedRunDetail(null)
      }
      setSyncError('')
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to load sync state.')
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshUniverseState()
        .finally(() => setLoading(false))
      void refreshSyncState()
      void refreshHighlights()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isSyncRunning) {
      return
    }

    const timer = window.setInterval(() => {
      void refreshSyncState()
    }, 1300)

    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncRunning, selectedRunId])

  const statusLabel = useMemo((): 'progress' | 'success' | 'empty' | 'idle' => {
    if (uploading) {
      return 'progress'
    }
    if (result || hasUniverse) {
      return 'success'
    }
    if (!loading && !hasUniverse) {
      return 'empty'
    }
    return 'idle'
  }, [uploading, result, loading, hasUniverse])

  const latestRun = syncRuns[0] ?? null
  const latestCompletedRun = syncRuns.find((run) => Boolean(run.finished_at)) ?? null
  const syncSummary = syncStatus && syncStatus.id > 0 ? syncStatus : latestRun

  const startUpload = async (mode: 'append' | 'replace', confirmedReplace: boolean) => {
    if (!file) {
      setError('Please choose a CSV file first.')
      return
    }

    setError('')
    setResult(null)
    setUploading(true)
    setProgress(8)

    progressTimer.current = window.setInterval(() => {
      setProgress((value) => (value < 92 ? value + 6 : value))
    }, 130)

    try {
      const response = await uploadUniverse(file, mode, confirmedReplace)
      setResult(response)
      setHasUniverse(true)
      setLastUniverseUpdateAt(response.created_at)
      setProgress(100)
      setCurrentCount(response.total - response.dup - response.invalid)
      await refreshUniverseState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setProgress(0)
    } finally {
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current)
      }
      setUploading(false)
    }
  }

  const openPicker = (nextIntent: 'append' | 'replace') => {
    setError('')
    setIntent(nextIntent)
    fileInputRef.current?.click()
  }

  const onFileChange = (nextFile: File | null) => {
    setFile(nextFile)
    if (!nextFile || intent === null) {
      return
    }

    if (intent === 'replace') {
      setShowConfirm(true)
      return
    }

    void startUpload('append', false)
  }

  const onClearUniverse = async () => {
    await clearUniverse()
    setResult(null)
    setFile(null)
    setIntent(null)
    setError('')
    setShowConfirm(false)
    setLastUniverseUpdateAt(null)
    await refreshUniverseState()
  }

  const onStartSync = async (mode: 'full' | 'incremental') => {
    try {
      setSyncError('')
      const run = await startSync(mode, 'universe')
      await refreshSyncState(run.id)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to start sync run.')
    }
  }

  const onRetryFailed = async () => {
    if (!selectedRunDetail) {
      return
    }

    try {
      setSyncError('')
      const run = await retryFailed(selectedRunDetail.run.id)
      await refreshSyncState(run.id)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to retry failed symbols.')
    }
  }

  const onAddHighlight = async () => {
    if (!hlDate) return
    setHlBusy(true)
    try {
      await createHighlight({
        label: hlLabel.trim() || 'Highlight',
        date_from: hlDate,
        symbol: hlSymbol.trim() ? hlSymbol.trim().toUpperCase() : null,
      })
      setHlDate('')
      setHlLabel('')
      setHlSymbol('')
      await refreshHighlights()
    } catch (err) {
      setHlError(err instanceof Error ? err.message : 'Failed to add highlight.')
    } finally {
      setHlBusy(false)
    }
  }

  const onSaveHighlightLabel = async (id: number) => {
    if (!hlEditLabel.trim()) return
    setHlBusy(true)
    try {
      await updateHighlight(id, { label: hlEditLabel.trim() })
      setHlEditId(null)
      await refreshHighlights()
    } catch (err) {
      setHlError(err instanceof Error ? err.message : 'Failed to update highlight.')
    } finally {
      setHlBusy(false)
    }
  }

  const onDeleteHighlight = async (id: number) => {
    setHlBusy(true)
    try {
      await deleteHighlight(id)
      await refreshHighlights()
    } catch (err) {
      setHlError(err instanceof Error ? err.message : 'Failed to delete highlight.')
    } finally {
      setHlBusy(false)
    }
  }

  const selectedRunFailedCount = selectedRunDetail?.items.filter((item) => item.status === 'fail').length ?? 0

  return (
    <section className='screen admin-page'>
      <div className='admin-wrap'>
        <div className='admin-intro'>
          <h1 className='screen-title'>Admin</h1>
          <p className='screen-subtitle'>Manage the stock universe, sync engine, book library, and chart highlights.</p>
        </div>

        <BookIngestCard />

        <div className='universe-card'>
          <div className='admin-head'>
            <div className='admin-title-wrap'>
              <UploadCloud size={18} />
              <h2 className='admin-title'>Stock Universe Upload</h2>
            </div>
            <span className='admin-state'>{statusLabel}</span>
          </div>

          <p className='screen-subtitle'>
            Controls which stocks appear in the main workspace. Upload the Nifty 200 stock list to define the active watchlist universe - only stocks in this list can be browsed and synced.
          </p>

          <div className='field-chips'>
            <span>Company name</span>
            <span>Symbol</span>
            <span>Industry</span>
            <span>Series</span>
            <span>ISIN</span>
          </div>

          <div className='universe-meta-grid'>
            <div className='summary-box'>
              <div>Active stocks</div>
              <strong>{currentCount}</strong>
            </div>
            <div className='summary-box'>
              <div>Last upload</div>
              <strong>{lastUniverseUpdateAt ? formatTimestamp(lastUniverseUpdateAt) : '-'}</strong>
            </div>
          </div>

          <input
            ref={fileInputRef}
            className='hidden-input'
            type='file'
            accept='.csv,text/csv'
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />

          <div className='drop-zone'>
            <FileSpreadsheet size={26} />
            <p>Drop a CSV or spreadsheet here, or</p>
            <div className='drop-actions'>
              <button type='button' className='btn-primary-inline' disabled={uploading} onClick={() => openPicker('append')}>
                Upload stock list
              </button>
              <button type='button' className='btn-secondary-inline' disabled={uploading} onClick={() => openPicker('replace')}>
                Replace existing list
              </button>
            </div>
            {file ? <div className='picked-file'>{file.name}</div> : null}
          </div>

          {showConfirm ? (
            <div className='confirm-inline'>
              <div className='confirm-title'>Replace the active universe?</div>
              <div className='confirm-copy'>
                The current {currentCount} stocks will be replaced. Stocks removed from the list will disappear from the workspace.
              </div>
              <div className='confirm-actions-inline'>
                <button
                  type='button'
                  className='btn-danger-inline'
                  onClick={() => {
                    setShowConfirm(false)
                    void startUpload('replace', true)
                  }}
                >
                  Confirm replace
                </button>
                <button type='button' className='btn-secondary-inline' onClick={() => setShowConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {uploading ? (
            <div className='progress-wrap'>
              <div className='progress-title'>
                <span>Uploading & validating...</span>
                <span>{progress}%</span>
              </div>
              <div className='progress-bar'>
                <div className='progress-fill' style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}

          {error ? (
            <div className='error-panel'>
              <div className='error-title'>
                <AlertTriangle size={16} />
                Validation failed
              </div>
              <div className='error-copy'>{error}</div>
            </div>
          ) : null}

          {result ? (
            <div className='success-banner'>
              <CheckCircle2 size={16} />
              <span>Universe updated. Last uploaded {formatTimestamp(result.created_at)}.</span>
            </div>
          ) : null}

          {result ? (
            <div className='summary-grid'>
              <div className='summary-box'>
                <div>Imported</div>
                <strong>{result.total}</strong>
              </div>
              <div className='summary-box'>
                <div>Duplicates</div>
                <strong>{result.dup}</strong>
              </div>
              <div className='summary-box'>
                <div>Invalid rows</div>
                <strong>{result.invalid}</strong>
              </div>
            </div>
          ) : null}

          {result || hasUniverse ? (
            <>
              <table className='preview-table'>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Industry</th>
                  </tr>
                </thead>
                <tbody>
                  {(universeRows.length > 0
                    ? universeRows
                    : (result?.preview ?? []).map((row) => ({
                        symbol: row.symbol,
                        company: row.company,
                        industry: row.industry,
                        id: row.symbol,
                      }))
                  )
                    .slice(0, 4)
                    .map((row) => (
                      <tr key={`${row.symbol}-${row.id}`}>
                        <td>{row.symbol}</td>
                        <td>{row.company}</td>
                        <td>{row.industry}</td>
                      </tr>
                    ))}
                </tbody>
              </table>

              <div className='clear-row'>
                <button type='button' className='clear-btn' onClick={() => void onClearUniverse()}>
                  <Trash2 size={13} />
                  Clear universe
                </button>
              </div>
            </>
          ) : null}

          {!loading && !hasUniverse && !uploading && !result ? (
            <div className='empty-dashed'>
              No stock universe uploaded yet. The workspace stock list will stay empty until a Nifty 200 list is imported.
            </div>
          ) : null}
        </div>

        <div className='sync-grid'>
          <div className='sync-card'>
            <div className='sync-card-title'>
              <RefreshCw size={18} />
              <span>Sync Control</span>
            </div>
            <div className='sync-actions'>
              <button type='button' disabled={isSyncRunning} className='btn-primary-inline' onClick={() => void onStartSync('full')}>
                Full Sync
              </button>
              <button type='button' disabled={isSyncRunning} className='btn-secondary-inline' onClick={() => void onStartSync('incremental')}>
                Incremental Sync
              </button>
            </div>
            <div className='sync-status-head'>
              <span className={`sync-dot ${syncSummary?.status ?? 'idle'}`} />
              <strong>
                {syncSummary?.status === 'running'
                  ? 'Running'
                  : syncSummary?.status === 'success'
                    ? 'Completed'
                    : syncSummary?.status === 'partial'
                      ? 'Partial failure'
                      : syncSummary?.status === 'failed'
                        ? 'Failed'
                        : 'Idle'}
              </strong>
              {syncSummary ? <span className='sync-status-mode'>{formatRunMode(syncSummary.mode, syncSummary.scope)}</span> : null}
            </div>
            <div className='sync-progress'>
              <div
                style={{
                  width: `${syncSummary && syncSummary.total ? Math.round((syncSummary.processed / syncSummary.total) * 100) : 0}%`,
                }}
              />
            </div>
            <div className='sync-metrics'>
              <div><span>Stocks processed</span><strong>{syncSummary?.processed ?? 0} / {syncSummary?.total ?? 0}</strong></div>
              <div><span>Stocks updated</span><strong>{syncSummary?.updated ?? 0}</strong></div>
              <div><span>Failed stocks</span><strong>{syncSummary?.failed ?? 0}</strong></div>
              <div><span>Started</span><strong>{syncSummary?.started_at ? formatTimestamp(syncSummary.started_at) : '-'}</strong></div>
              <div><span>Last successful</span><strong>{latestCompletedRun?.finished_at ? formatTimestamp(latestCompletedRun.finished_at) : '-'}</strong></div>
            </div>
            {syncSummary?.status === 'partial' || syncSummary?.status === 'failed' ? (
              <div className='sync-error-banner'>
                <strong>{syncSummary.status === 'partial' ? 'Partial failure' : 'Sync failed'}</strong>
                {syncSummary.error ? ` — ${syncSummary.error}` : ` — ${syncSummary.failed} symbol(s) failed. Use Retry failed below.`}
              </div>
            ) : syncSummary?.error ? (
              <div className='sync-error-banner'>{syncSummary.error}</div>
            ) : null}
            {syncError ? <div className='sync-error-banner'>{syncError}</div> : null}
          </div>

          <div className='sync-card'>
            <div className='sync-card-title'>
              <span>Recent Sync Logs</span>
            </div>
            {syncRuns.length === 0 ? <div className='empty-dashed'>No sync runs recorded yet.</div> : null}
            <div className='sync-run-list'>
              {syncRuns.map((run) => (
                <button
                  type='button'
                  key={run.id}
                  className={`sync-run-row ${selectedRunId === run.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedRunId(run.id)
                    void refreshSyncState(run.id)
                  }}
                >
                  <div className='sync-run-head'>
                    <span className={`run-chip ${run.status}`}>{run.status}</span>
                    <strong>{formatRunMode(run.mode, run.scope)}</strong>
                    <span>{formatTimestamp(run.started_at)}</span>
                  </div>
                  <div className='sync-run-sub'>{run.processed} processed · {run.updated} updated · {run.failed} failed</div>
                  {run.error ? <div className='sync-run-error'>{run.error}</div> : null}
                </button>
              ))}
            </div>
          </div>

          <div className='sync-card sync-detail-card'>
            <div className='sync-card-title'>
              <span>Run Detail</span>
              {selectedRunFailedCount > 0 ? (
                <button type='button' className='retry-btn' disabled={isSyncRunning} onClick={() => void onRetryFailed()}>
                  <RotateCw size={13} />
                  Retry failed ({selectedRunFailedCount})
                </button>
              ) : null}
            </div>

            <div className='sync-detail-scroll'>
              {!selectedRunDetail ? (
                <div className='empty-dashed'>Select a sync log to see per-stock results.</div>
              ) : (
                <table className='run-detail-table'>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Status</th>
                      <th>Rows</th>
                      <th>Window</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRunDetail.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.symbol}</td>
                        <td>
                          <span className={`run-chip ${item.status === 'ok' ? 'success' : 'failed'}`}>
                            {item.status === 'ok' ? 'ok' : 'fail'}
                          </span>
                        </td>
                        <td>{item.rows}</td>
                        <td>{item.window}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedRunDetail?.items.some((item) => item.message) ? (
                <div className='run-messages'>
                  {selectedRunDetail.items
                    .filter((item) => item.message)
                    .map((item) => (
                      <div key={`msg-${item.id}`} className='run-msg'>
                        <strong>{item.symbol}:</strong> {item.message}
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className='sync-card hl-card'>
          <div className='sync-card-title'>
            <CalendarDays size={18} />
            <span>Chart Highlights</span>
          </div>
          <div className='hl-form'>
            <label>
              Date
              <input type='date' value={hlDate} onChange={(event) => setHlDate(event.target.value)} />
            </label>
            <label className='grow'>
              Label
              <input
                value={hlLabel}
                onChange={(event) => setHlLabel(event.target.value)}
                placeholder='Results day, Breakout, Review…'
              />
            </label>
            <label>
              Symbol <em>(optional)</em>
              <input
                value={hlSymbol}
                onChange={(event) => setHlSymbol(event.target.value.toUpperCase())}
                placeholder='All charts'
              />
            </label>
            <div className='hl-color'>
              <span>Color</span>
              <div style={{ background: previewColor }} />
            </div>
          </div>
          <div className='hl-form-foot'>
            <span>Same label reuses its color; a new label gets a distinct one.</span>
            <button type='button' className='btn-primary-inline' disabled={!hlDate || hlBusy} onClick={() => void onAddHighlight()}>
              Add date
            </button>
          </div>
          {reuseNote ? <div className='hl-reuse'>{reuseNote}</div> : null}
          {hlError ? <div className='sync-error-banner'>{hlError}</div> : null}
          {highlights.length === 0 ? (
            <div className='empty-dashed'>No highlight dates yet.</div>
          ) : (
            <div className='hl-list'>
              {highlights.map((item) => (
                <div key={item.id} className='hl-row'>
                  <span className='hl-swatch' style={{ background: item.color }} />
                  <strong>
                    {item.date_from === item.date_to
                      ? new Date(`${item.date_from}T00:00:00`).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : `${item.date_from} → ${item.date_to}`}
                  </strong>
                  <span className='hl-label'>{item.label}</span>
                  {item.symbol ? <em>{item.symbol}</em> : null}
                  {hlEditId === item.id ? (
                    <div className='hl-edit'>
                      <input
                        value={hlEditLabel}
                        onChange={(event) => setHlEditLabel(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void onSaveHighlightLabel(item.id)
                          if (event.key === 'Escape') setHlEditId(null)
                        }}
                        autoFocus
                      />
                      <button type='button' onClick={() => void onSaveHighlightLabel(item.id)} disabled={hlBusy}>
                        Save
                      </button>
                      <button type='button' onClick={() => setHlEditId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type='button'
                      className='hl-edit-btn'
                      title='Rename label'
                      onClick={() => {
                        setHlEditId(item.id)
                        setHlEditLabel(item.label)
                      }}
                    >
                      Edit
                    </button>
                  )}
                  <button type='button' title='Delete' onClick={() => void onDeleteHighlight(item.id)} disabled={hlBusy}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
