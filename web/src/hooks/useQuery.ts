import { useEffect, useState } from 'react'

type QueryState<T> = {
  loading: boolean
  error: Error | null
  data: T | null
}

export function useQuery<T>(fetcher: () => Promise<T>, deps: readonly unknown[] = []): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    loading: true,
    error: null,
    data: null,
  })

  useEffect(() => {
    let cancelled = false

    setState({ loading: true, error: null, data: null })
    fetcher()
      .then((result) => {
        if (!cancelled) {
          setState({ loading: false, error: null, data: result })
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setState({ loading: false, error: err, data: null })
        }
      })

    return () => {
      cancelled = true
    }
  }, deps)

  return state
}
