import { useCallback, useRef, useState } from 'react';
import { runAction } from '../lib/pipeline.js';

const keyOf = (captureId, action) => `${captureId}:${action}`;

/** Tracks one run per (selection, action): loading, done or error. Starting again replaces the old run. */
export default function useRuns() {
  const [runs, setRuns] = useState({});
  const aborts = useRef({});

  const start = useCallback(async ({ captureId, action, ...args }) => {
    const k = keyOf(captureId, action);
    aborts.current[k]?.abort();
    const ac = new AbortController();
    aborts.current[k] = ac;
    setRuns((r) => ({ ...r, [k]: { status: 'loading', profileName: args.profile.name } }));
    try {
      const onPartial = (partial) => { if (!ac.signal.aborted) setRuns((r) => (r[k]?.status === 'loading' ? { ...r, [k]: { ...r[k], partial } } : r)); };
      const data = await runAction({ action, signal: ac.signal, onPartial, ...args });
      if (!ac.signal.aborted) setRuns((r) => ({ ...r, [k]: { status: 'done', data } }));
    } catch (e) {
      if (!ac.signal.aborted) setRuns((r) => ({ ...r, [k]: { status: 'error', error: e.message || 'Something went wrong.' } }));
    }
  }, []);

  const cancel = useCallback((captureId, action) => {
    const k = keyOf(captureId, action);
    aborts.current[k]?.abort();
    setRuns((r) => { const { [k]: _gone, ...rest } = r; return rest; });
  }, []);

  const get = useCallback((captureId, action) => runs[keyOf(captureId, action)], [runs]);
  return { start, cancel, get };
}