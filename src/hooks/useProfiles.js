import { useCallback, useEffect, useMemo, useState } from 'react';
import { BUILT_INS, makeProfile, newId, normalizeProfile, SCHEMA_VERSION } from '../lib/profileSchema.js';

const KEY = 'studylens.profiles.v1';
const builtInIds = new Set(BUILT_INS.map((p) => p.id));

function load() {
  const fresh = { custom: [], activeId: BUILT_INS[0].id };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    const custom = (Array.isArray(raw?.custom) ? raw.custom : [])
      .map(normalizeProfile).filter((p) => p && !builtInIds.has(p.id));
    const known = [...BUILT_INS, ...custom].some((p) => p.id === raw?.activeId);
    return { custom, activeId: known ? raw.activeId : fresh.activeId };
  } catch {
    return fresh;
  }
}

function canPersist() {
  try { localStorage.setItem(`${KEY}.probe`, '1'); localStorage.removeItem(`${KEY}.probe`); return true; } catch { return false; }
}

/** Built-in presets live in code; only user-made profiles and the active choice are stored. */
export default function useProfiles() {
  const [state, setState] = useState(load);
  const persistent = useMemo(canPersist, []);

  // Ask the browser not to evict saved structures when it is short on space.
  useEffect(() => { try { navigator.storage?.persist?.()?.catch?.(() => {}); } catch { /* unsupported */ } }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: SCHEMA_VERSION, ...state }));
    } catch { /* storage unavailable */ }
  }, [state]);

  const profiles = useMemo(() => [...BUILT_INS, ...state.custom], [state.custom]);
  const active = profiles.find((p) => p.id === state.activeId) ?? BUILT_INS[0];

  const select = useCallback((id) => setState((s) => ({ ...s, activeId: id })), []);

  const addCustom = useCallback((profile) => {
    setState((s) => ({ ...s, custom: [...s.custom, profile] }));
    return profile.id;
  }, []);

  const create = useCallback(
    () => addCustom(makeProfile({ name: 'My structure', enabled: ['topic', 'one_line', 'key_points'] })),
    [addCustom],
  );

  const duplicate = useCallback((source) => addCustom({
    ...structuredClone(source), id: newId(), builtIn: false,
    name: source.builtIn ? `My ${source.name}` : `${source.name} copy`,
  }), [addCustom]);

  // Saving makes that structure the one in use, so what you edited is what you see in the panel.
  const save = useCallback((profile) => {
    const clean = normalizeProfile(profile);
    setState((s) => ({ ...s, custom: s.custom.map((p) => (p.id === clean.id ? clean : p)), activeId: clean.id }));
  }, []);

  /** Keeps an edited preset as the user's own structure (presets themselves never change) and uses it. */
  const saveAsNew = useCallback((profile) => {
    const clean = { ...normalizeProfile(profile), id: newId() };
    setState((s) => ({ ...s, custom: [...s.custom, clean], activeId: clean.id }));
    return clean.id;
  }, []);

  const importProfiles = useCallback((list) => {
    const added = (Array.isArray(list) ? list : []).map(normalizeProfile).filter(Boolean).map((p) => ({ ...p, id: newId() }));
    if (!added.length) throw new Error('No study structures found in that file.');
    setState((s) => ({ ...s, custom: [...s.custom, ...added] }));
    return added.length;
  }, []);

  const remove = useCallback((id) => setState((s) => ({
    custom: s.custom.filter((p) => p.id !== id),
    activeId: s.activeId === id ? BUILT_INS[0].id : s.activeId,
  })), []);

  return { profiles, active, select, create, duplicate, save, saveAsNew, importProfiles, remove, persistent };
}
