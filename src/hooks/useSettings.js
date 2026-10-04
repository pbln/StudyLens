import { useCallback, useState } from 'react';
import { MODEL_DEFAULTS } from '../lib/gemma/index.js';

const KEY = 'studylens.settings.v1';
export const DEFAULT_SETTINGS = { defaultZoom: 1.25, panelTextSize: 'medium', autoOpenPanel: true, panelWidth: 340, ...MODEL_DEFAULTS };

function load() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export default function useSettings() {
  const [settings, setSettings] = useState(load);
  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  return [settings, update];
}