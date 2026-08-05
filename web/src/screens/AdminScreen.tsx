import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Trash2, UploadCloud } from 'lucide-react'
import { clearUniverse, getUniverse, uploadUniverse, type UniverseUploadResponse } from '../api/universe'

type UploadIntent = 'append' | 'replace' | null

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  const [loading, setLoading] = useState(true)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const progressTimer = useRef<number | null>(null)

  const refreshUniverseState = () => {
    return getUniverse()
      .then((rows) => {
        setCurrentCount(rows.length)
        setHasUniverse(rows.length > 0)
      })
      .catch(() => setError('Failed to load universe state.'))
  }

  useEffect(() => {
    refreshUniverseState()
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    return () => {
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current)
      }
    }
  }, [])

  const statusLabel = useMemo((): 'progress' | 'success' | 'empty' | 'idle' => {
    if (uploading) {
      return 'progress'
    }
    if (result) {
      return 'success'
    }
    if (!loading && !hasUniverse) {
      return 'empty'
    }
    return 'idle'
  }, [uploading, result, loading, hasUniverse])

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
      setProgress(100)
      setCurrentCount(response.total - response.dup - response.invalid)
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
    await refreshUniverseState()
  }

  return (
    <section className='screen admin-page'>
      <div className='admin-wrap'>
        <div className='admin-intro'>
          <h1 className='screen-title'>Admin</h1>
          <p className='screen-subtitle'>Manage the stock universe, sync engine, book library, and chart highlights.</p>
        </div>

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
            <>
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

              <table className='preview-table'>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Industry</th>
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((row) => (
                    <tr key={`${row.symbol}-${row.isin}`}>
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
      </div>
    </section>
  )
}
