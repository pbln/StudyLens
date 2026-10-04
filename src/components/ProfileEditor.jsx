import { useEffect, useState } from 'react';
import {
  DEPTHS, EXAMS, KEY_POINTS_RANGE, LANGUAGES, SECTIONS, validateProfile,
} from '../lib/profileSchema.js';
import { moveSection, moveSectionTo, toggleSection } from '../lib/profileOps.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const info = (id) => SECTIONS.find((s) => s.id === id);
const readText = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsText(file);
});

export default function ProfileEditor({ store, onClose }) {
  const { profiles, active, select, create, duplicate, save, saveAsNew, importProfiles, remove, persistent } = store;
  const [selectedId, setSelectedId] = useState(active.id);
  const selected = profiles.find((p) => p.id === selectedId) ?? profiles[0];
  const [draft, setDraft] = useState(selected);
  const [dragFrom, setDragFrom] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => { setDraft(selected); }, [selected.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPreset = selected.builtIn;
  const dirty = !same(draft, selected);
  const errors = validateProfile(draft);
  useEffect(() => { if (dirty) setNotice(''); }, [dirty]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const guard = (fn) => () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setNotice('');
    fn();
  };

  const doSave = () => {
    if (isPreset) {
      const name = draft.name.trim() === selected.name ? `My ${selected.name}` : draft.name.trim();
      setSelectedId(saveAsNew({ ...draft, name }));
    } else {
      save(draft);
    }
    setNotice('Saved. This structure is now in use.');
  };

  const exportFile = () => {
    const custom = profiles.filter((p) => !p.builtIn);
    const url = URL.createObjectURL(new Blob([JSON.stringify({ app: 'studylens', version: 1, profiles: custom }, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'studylens-structures.json' });
    a.click();
    URL.revokeObjectURL(url);
  };
  const importFile = async (file) => {
    try {
      const raw = JSON.parse(await readText(file));
      setNotice(`Imported ${importProfiles(Array.isArray(raw) ? raw : raw?.profiles)} structure(s).`);
    } catch (e) {
      setNotice(e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message);
    }
  };

  let position = 0;
  return (
    <div className="scrim" onMouseDown={guard(onClose)}>
      <div className="dialog editor" role="dialog" aria-label="Study structures" onMouseDown={(e) => e.stopPropagation()}>
        <aside className="plist">
          <h2>Study structures</h2>
          <ul>
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  className={p.id === selected.id ? 'on' : ''} aria-current={p.id === selected.id}
                  onClick={guard(() => setSelectedId(p.id))}
                >
                  {p.name}
                  <small>{p.builtIn ? 'Preset' : 'Yours'}{p.id === active.id ? ' · in use' : ''}</small>
                </button>
              </li>
            ))}
          </ul>
          <button onClick={guard(() => setSelectedId(create()))}>New structure</button>
          <div className="row">
            <button className="link" onClick={exportFile}>Export</button>
            <label className="link filebtn-link">
              Import
              <input type="file" accept="application/json,.json" hidden aria-label="Structures file"
                onChange={(e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; }} />
            </label>
          </div>
        </aside>

        <section className="pform">
          {!persistent && (
            <p className="error-box" role="alert">
              Your browser is blocking storage, so structures won’t be remembered after you close this page. Use a normal (non-private) window.
            </p>
          )}
          {isPreset && (
            <div className="note">
              Presets stay as they are. Change anything you like, then choose “Save as my structure and use” to keep your own version.
            </div>
          )}
          <fieldset>
            <label>Name
              <input value={draft.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <div className="grid2">
              <label>Target exam
                <select value={draft.targetExam.type} onChange={(e) => set({ targetExam: { ...draft.targetExam, type: e.target.value } })}>
                  {EXAMS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
              {draft.targetExam.type === 'Custom' && (
                <label>Exam name
                  <input value={draft.targetExam.custom} maxLength={60}
                    onChange={(e) => set({ targetExam: { ...draft.targetExam, custom: e.target.value } })} />
                </label>
              )}
              <label>Explanation depth
                <select value={draft.depth} onChange={(e) => set({ depth: e.target.value })}>
                  {DEPTHS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </label>
              <label>Language
                <select value={draft.language} onChange={(e) => set({ language: e.target.value })}>
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </label>
              <label>Max key points
                <input type="number" min={KEY_POINTS_RANGE.min} max={KEY_POINTS_RANGE.max} value={draft.maxKeyPoints}
                  onChange={(e) => set({ maxKeyPoints: e.target.value === '' ? '' : Number(e.target.value) })} />
              </label>
            </div>

            <h3>Sections</h3>
            <p className="meta">Switch sections on or off. Drag them, or use the arrows, to set the order notes appear in.</p>
            <ul className="sections">
              {draft.sections.map((s, i) => {
                const { label, hint } = info(s.id);
                const pos = s.enabled ? ++position : null;
                return (
                  <li
                    key={s.id} className={s.enabled ? '' : 'off'} draggable
                    onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragFrom !== null) setDraft((d) => moveSectionTo(d, dragFrom, i)); setDragFrom(null); }}
                  >
                    <span className="pos" aria-hidden="true">{pos ?? ''}</span>
                    <label className="check">
                      <input type="checkbox" aria-label={`Include ${label}`} checked={s.enabled}
                        onChange={() => setDraft((d) => toggleSection(d, s.id))} />
                      <span>{label}<small>{hint}</small></span>
                    </label>
                    <button aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => setDraft((d) => moveSection(d, s.id, -1))}>↑</button>
                    <button aria-label={`Move ${label} down`} disabled={i === draft.sections.length - 1} onClick={() => setDraft((d) => moveSection(d, s.id, 1))}>↓</button>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {errors.length > 0 && <ul className="errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {notice && <p className="meta ok" role="status">{notice}</p>}
          <details>
            <summary>Saved configuration</summary>
            <pre>{JSON.stringify(draft, null, 2)}</pre>
          </details>

          <div className="actions">
            <button className="primary" disabled={!dirty || errors.length > 0} onClick={doSave}>
              {isPreset ? 'Save as my structure and use' : 'Save and use'}
            </button>
            <button disabled={!dirty} onClick={() => setDraft(selected)}>Discard changes</button>
            <button disabled={selected.id === active.id || dirty} onClick={() => select(selected.id)}>Use this structure</button>
            <button onClick={guard(() => setSelectedId(duplicate(selected)))}>Duplicate</button>
            {!isPreset && (
              <button className="danger" onClick={() => { if (window.confirm(`Delete “${selected.name}”?`)) { remove(selected.id); setSelectedId(profiles[0].id); } }}>Delete</button>
            )}
            <span className="spacer" />
            <button onClick={guard(onClose)}>Done</button>
          </div>
        </section>
      </div>
    </div>
  );
}
