import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StubScreen } from './StubScreen'

const filterTitles: Record<string, string> = {
  all: 'Market workspace',
  ma: 'Signals · above 44 MA',
  watch: 'Watchlist',
  fav: 'Research · favorites',
}

export function WorkspaceScreen() {
  const [params] = useSearchParams()
  const title = useMemo(() => {
    const filter = params.get('filter') ?? 'all'
    return filterTitles[filter] ?? filterTitles.all
  }, [params])

  return <StubScreen title={title} />
}
