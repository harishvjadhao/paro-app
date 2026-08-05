import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card } from '../components/primitives'
import { getUniverse, uploadUniverse, type UniverseUploadResponse } from '../api/universe'

type UploadMode = 'append' | 'replace'

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
  const [mode, setMode] = useState<UploadMode>('append')
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<UniverseUploadResponse | null>(null)
  const [hasUniverse, setHasUniverse] = useState(false)
  const [loading, setLoading] = useState(true)

  const progressTimer = useRef<number | null>(null)

  useEffect(() => {
    getUniverse()
      .then((rows) => setHasUniverse(rows.length > 0))
      .catch(() => setError('Failed to load universe state.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    return () => {
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current)
      }
    }
  }, [])

  const statusLabel = useMemo(() => {
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

  const startUpload = async (confirmedReplace: boolean) => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current)
      }
      setUploading(false)
    }
  }

  const onUploadClick = () => {
    if (mode === 'replace') {
      setShowConfirm(true)
      return
    }
    void startUpload(false)
  }

  return (
    <section className='screen'>
      <h1 className='screen-title'>Admin</h1>
      <Card>
        <div className='admin-head'>
          <h2 className='admin-title'>Universe upload</h2>
          <span className='admin-state'>{statusLabel}</span>
        </div>

        <p className='screen-subtitle'>Upload NSE universe CSV and merge or replace existing records.</p>

        <div className='admin-form'>
          <input
            className='file-input'
            type='file'
            accept='.csv,text/csv'
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <select
            className='mode-select'
            value={mode}
            onChange={(event) => setMode(event.target.value as UploadMode)}
            disabled={uploading}
          >
            <option value='append'>Append</option>
            <option value='replace'>Replace</option>
          </select>
          <Button onClick={onUploadClick} kind='primary'>
            Upload
          </Button>
        </div>

        {error ? <p className='admin-error'>{error}</p> : null}

        {!loading && !hasUniverse && !uploading && !result ? (
          <div className='empty-dashed'>No stock universe uploaded yet</div>
        ) : null}

        {uploading ? (
          <div className='progress-wrap'>
            <div className='progress-bar'>
              <div className='progress-fill' style={{ width: `${progress}%` }} />
            </div>
            <p className='screen-subtitle'>{progress}%</p>
          </div>
        ) : null}

        {result ? (
          <div className='success-wrap'>
            <p className='screen-subtitle'>
              Total: {result.total} · Duplicates: {result.dup} · Invalid: {result.invalid}
            </p>
            <p className='screen-subtitle'>Updated: {formatTimestamp(result.created_at)}</p>
            <table className='preview-table'>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Company</th>
                  <th>Industry</th>
                  <th>ISIN</th>
                </tr>
              </thead>
              <tbody>
                {result.preview.map((row) => (
                  <tr key={`${row.symbol}-${row.isin}`}>
                    <td>{row.symbol}</td>
                    <td>{row.company}</td>
                    <td>{row.industry}</td>
                    <td>{row.isin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {showConfirm ? (
        <div className='confirm-overlay'>
          <div className='confirm-modal'>
            <h3>Replace universe?</h3>
            <p>This action clears existing records before loading this file.</p>
            <div className='confirm-actions'>
              <Button kind='secondary' onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button
                kind='primary'
                onClick={() => {
                  setShowConfirm(false)
                  void startUpload(true)
                }}
              >
                Confirm replace
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
