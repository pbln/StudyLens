import { useCallback, useState } from 'react';
import { normalizeEntries, parsePyqBank } from '../lib/pyq.js';

const KEY = 'studylens.pyq.v1';

function load() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? normalizeEntries(v) : []; } catch { return []; }
}

/** The user's own bank of real previous-year questions, kept in this browser. */
export default function usePyqBank() {
  const [entries, setEntries] = useState(load);

  const importText = useCallback((jsonText) => {
    const { entries: next, skipped } = parsePyqBank(jsonText); // throws a readable Error
    if (!next.length) throw new Error('No usable questions found. Each needs “question”, “exam” and “year”.');
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { throw new Error('This file is too large to store in the browser.'); }
    setEntries(next);
    return { count: next.length, skipped };
  }, []);

  const clear = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    setEntries([]);
  }, []);

  return { entries, importText, clear };
}
