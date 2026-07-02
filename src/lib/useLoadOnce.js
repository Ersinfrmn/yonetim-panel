import { useEffect, useRef } from 'react'

// Mount-time data fetching that runs exactly once per mount (and again only
// when deps actually change). React StrictMode double-invokes effects in dev,
// which made every Supabase query fire twice per page load — the key guard
// skips the duplicate invocation while still refetching on real deps changes.
export function useLoadOnce(fn, deps = []) {
  const lastKey = useRef(null)
  useEffect(() => {
    const key = JSON.stringify(deps)
    if (lastKey.current === key) return
    lastKey.current = key
    fn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
