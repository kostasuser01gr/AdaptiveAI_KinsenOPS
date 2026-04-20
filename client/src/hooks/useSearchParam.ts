import { useCallback, useSyncExternalStore } from 'react';

function subscribe(cb: () => void) {
  window.addEventListener('popstate', cb);
  return () => window.removeEventListener('popstate', cb);
}

/**
 * Syncs a single URL search param with React state.
 * Returns [value, setValue] — works like useState but persists to the URL.
 */
export function useSearchParam(key: string, defaultValue: string = ''): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(key) ?? defaultValue,
    () => defaultValue,
  );

  const setValue = useCallback((next: string) => {
    const url = new URL(window.location.href);
    if (next === defaultValue || next === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, next);
    }
    window.history.replaceState(null, '', url.pathname + url.search);
    // Trigger re-render by dispatching popstate
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [key, defaultValue]);

  return [value, setValue];
}
