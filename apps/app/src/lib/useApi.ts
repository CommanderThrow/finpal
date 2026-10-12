import { useCallback, useEffect, useState } from 'react';

import { api } from './api';

/** Loads `path` from the backend and reloads whenever it changes. */
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    api<T>(path)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [path]);

  useEffect(reload, [reload]);

  return { data, error, reload, setData };
}
