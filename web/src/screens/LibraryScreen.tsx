import { useEffect, useState } from 'react'
import { BookOpen, MoreHorizontal, Trash2, X } from 'lucide-react'
import {
  deleteBook,
  getBook,
  listBooks,
  renameBook,
  type BookDetail,
  type BookShelfItem,
} from '../api/library'
import { BookReader } from '../components/BookReader'

export function LibraryScreen() {
  const [books, setBooks] = useState<BookShelfItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [menuId, setMenuId] = useState<number | null>(null)
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameText, setRenameText] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [openBook, setOpenBook] = useState<BookDetail | null>(null)

  const reload = async () => {
    setLoading(true)
    setError('')
    try {
      setBooks(await listBooks())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const open = async (bookId: number) => {
    try {
      const detail = await getBook(bookId)
      setOpenBook(detail)
      setMenuId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open book.')
    }
  }

  const onRename = async () => {
    if (renameId == null || !renameText.trim()) return
    try {
      await renameBook(renameId, renameText.trim())
      setRenameId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed.')
    }
  }

  const onDelete = async () => {
    if (deleteId == null) return
    try {
      await deleteBook(deleteId)
      if (openBook?.id === deleteId) setOpenBook(null)
      setDeleteId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  if (openBook) {
    return (
      <BookReader
        book={openBook}
        onClose={() => {
          setOpenBook(null)
          void reload()
        }}
      />
    )
  }

  return (
    <section className='screen library-screen'>
      <div className='library-header'>
        <div>
          <h1 className='screen-title'>Library</h1>
          <p className='library-subtitle'>Open a book to read with progress, bookmarks, and highlights.</p>
        </div>
      </div>

      {loading ? <div className='library-empty'>Loading shelf…</div> : null}
      {error ? <div className='library-empty library-error'>{error}</div> : null}

      {!loading && !books.length ? (
        <div className='library-empty dashed'>No books yet. Upload a PDF from Admin › Book Library.</div>
      ) : null}

      <div className='library-shelf'>
        {books.map((book) => (
          <div key={book.id} className='library-book'>
            <button type='button' className='library-spine' style={{ background: book.spine_color }} onClick={() => void open(book.id)}>
              <BookOpen size={18} />
              <strong>{book.title}</strong>
              <span>{book.tag}</span>
            </button>
            <div className='library-book-meta'>
              <div>
                <strong>{book.title}</strong>
                <span>
                  {book.kind} · {book.status}
                  {book.page_count ? ` · ${book.page_count} pages` : ''}
                  {book.status === 'ready' ? ` · ${book.progress_pct}% read` : ''}
                </span>
              </div>
              <div className='library-book-menu'>
                <button type='button' onClick={() => setMenuId(menuId === book.id ? null : book.id)}>
                  <MoreHorizontal size={16} />
                </button>
                {menuId === book.id ? (
                  <div className='library-menu-pop'>
                    <button
                      type='button'
                      onClick={() => {
                        setRenameId(book.id)
                        setRenameText(book.title)
                        setMenuId(null)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type='button'
                      className='danger'
                      onClick={() => {
                        setDeleteId(book.id)
                        setMenuId(null)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {renameId != null ? (
        <div className='library-modal-backdrop' onClick={() => setRenameId(null)}>
          <div className='library-modal' onClick={(event) => event.stopPropagation()}>
            <div className='library-modal-head'>
              <strong>Rename book</strong>
              <button type='button' onClick={() => setRenameId(null)}>
                <X size={16} />
              </button>
            </div>
            <input value={renameText} onChange={(event) => setRenameText(event.target.value)} />
            <div className='library-modal-actions'>
              <button type='button' onClick={() => setRenameId(null)}>
                Cancel
              </button>
              <button type='button' className='primary' onClick={() => void onRename()}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteId != null ? (
        <div className='library-modal-backdrop' onClick={() => setDeleteId(null)}>
          <div className='library-modal' onClick={(event) => event.stopPropagation()}>
            <div className='library-modal-head'>
              <strong>Delete “{books.find((b) => b.id === deleteId)?.title ?? 'book'}”?</strong>
              <button type='button' onClick={() => setDeleteId(null)}>
                <X size={16} />
              </button>
            </div>
            <p>This removes the PDF, pages, chunks, reading progress, bookmarks, and highlights. It cannot be undone.</p>
            <div className='library-modal-actions'>
              <button type='button' onClick={() => setDeleteId(null)}>
                Cancel
              </button>
              <button type='button' className='danger' onClick={() => void onDelete()}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
