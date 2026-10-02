import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookUp, Check, CheckCircle2, FileText, Loader, ScanLine } from 'lucide-react'
import { getIngestionJob, uploadBook, type IngestionJob } from '../api/library'

type IngestState = 'idle' | 'picked' | 'active' | 'done' | 'error'
type Kind = 'text' | 'scanned'

const STEPS = ['Upload', 'Parse / OCR', 'Embed', 'Ready'] as const

function stepIndex(state: string): number {
  if (state === 'ready') return 3
  if (state === 'embedding') return 2
  if (state === 'parsing' || state === 'ocr') return 1
  return 0
}

export function BookIngestCard() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uiState, setUiState] = useState<IngestState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<Kind>('text')
  const [drag, setDrag] = useState(false)
  const [job, setJob] = useState<IngestionJob | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (uiState !== 'active' || !job) return
    if (job.state === 'ready' || job.state === 'failed') return
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const next = await getIngestionJob(job.id)
          setJob(next)
          if (next.state === 'ready') setUiState('done')
          if (next.state === 'failed') {
            setError(next.error || 'Ingestion failed.')
            setUiState('error')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to poll job.')
          setUiState('error')
        }
      })()
    }, 700)
    return () => window.clearInterval(timer)
  }, [uiState, job])

  const pick = (next: File | null) => {
    if (!next) return
    if (!next.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.')
      setUiState('error')
      return
    }
    setFile(next)
    setError('')
    setKind(/scan|image|ocr/i.test(next.name) ? 'scanned' : 'text')
    setUiState('picked')
  }

  const start = async () => {
    if (!file) return
    setUiState('active')
    setError('')
    try {
      const result = await uploadBook(file, kind)
      const initial = await getIngestionJob(result.job_id)
      setJob(initial)
      if (initial.state === 'ready') setUiState('done')
      if (initial.state === 'failed') {
        setError(initial.error || 'Ingestion failed.')
        setUiState('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
      setUiState('error')
    }
  }

  const reset = () => {
    setFile(null)
    setJob(null)
    setError('')
    setUiState('idle')
    setKind('text')
    if (inputRef.current) inputRef.current.value = ''
  }

  const activeStep = stepIndex(job?.state || 'queued')

  return (
    <div className='universe-card ingest-card'>
      <div className='admin-head'>
        <div className='admin-title-wrap'>
          <BookUp size={18} />
          <h2 className='admin-title'>Book Library · PDF Ingestion</h2>
        </div>
      </div>
      <p className='screen-subtitle'>
        Upload a text or scanned PDF. The pipeline detects kind, extracts or OCRs pages, then adds the book to the Library shelf.
      </p>

      <input
        ref={inputRef}
        className='hidden-input'
        type='file'
        accept='application/pdf,.pdf'
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />

      {uiState === 'idle' || uiState === 'error' ? (
        <>
          <div
            className={`drop-zone ${drag ? 'dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDrag(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setDrag(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDrag(false)
              pick(event.dataTransfer.files?.[0] ?? null)
            }}
            onClick={() => inputRef.current?.click()}
          >
            <FileText size={26} />
            <p>Drop a PDF here, or click to browse</p>
            <small>Scanned / image PDFs are auto-detected for OCR.</small>
          </div>
          {error ? <div className='sync-error-banner'>{error}</div> : null}
        </>
      ) : null}

      {uiState === 'picked' && file ? (
        <div className='ingest-picked'>
          <div className='ingest-file'>
            <FileText size={18} />
            <strong>{file.name}</strong>
          </div>
          <div className='ingest-kind-label'>Source type</div>
          <div className='ingest-kind'>
            <button type='button' className={kind === 'text' ? 'active' : ''} onClick={() => setKind('text')}>
              <FileText size={13} /> Text PDF
            </button>
            <button type='button' className={kind === 'scanned' ? 'active' : ''} onClick={() => setKind('scanned')}>
              <ScanLine size={13} /> Scanned / OCR
            </button>
          </div>
          <div className='ingest-actions'>
            <button type='button' className='btn-primary-inline' onClick={() => void start()}>
              Start ingestion
            </button>
            <button type='button' className='btn-secondary-inline' onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {uiState === 'active' && job ? (
        <div className='ingest-active'>
          <div className='ingest-active-head'>
            <span>{file?.name}</span>
            <strong>{job.pct}%</strong>
          </div>
          <div className='ingest-bar'>
            <div style={{ width: `${job.pct}%` }} />
          </div>
          <div className='ingest-steps'>
            {STEPS.map((label, index) => (
              <div key={label} className={`ingest-step ${index <= activeStep ? 'done' : ''} ${index === activeStep ? 'current' : ''}`}>
                <span>{index < activeStep ? <Check size={12} /> : index + 1}</span>
                <em>{label}</em>
              </div>
            ))}
          </div>
          <div className='ingest-stage'>
            <Loader size={13} /> {job.stage || 'Working…'}
          </div>
        </div>
      ) : null}

      {uiState === 'done' && job?.report ? (
        <div className='ingest-done'>
          <div className='ingest-done-banner'>
            <CheckCircle2 size={18} />
            <div>
              <strong>{file?.name} added to the Library</strong>
              <span>Parsed, embedded, and ready to read with cited Q&amp;A.</span>
            </div>
            <button type='button' className='btn-primary-inline' onClick={() => navigate('/library')}>
              Open Library
            </button>
            <button type='button' className='btn-secondary-inline' onClick={reset}>
              Upload another
            </button>
          </div>
          <div className='ingest-report'>
            <div>
              <span>Pages</span>
              <strong>{job.report.pages}</strong>
            </div>
            <div>
              <span>Chunks</span>
              <strong>{job.report.chunks}</strong>
            </div>
            <div>
              <span>Tokens</span>
              <strong>{job.report.tokens >= 1000 ? `${Math.round(job.report.tokens / 1000)}k` : job.report.tokens}</strong>
            </div>
            <div>
              <span>OCR confidence</span>
              <strong>{job.report.ocr_confidence == null ? 'n/a' : `${job.report.ocr_confidence}%`}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
