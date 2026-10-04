import { countWords } from '../lib/selection.js';
import StructurePreview from './StructurePreview.jsx';
import RunView from './results/RunView.jsx';

const TABS = [
  { id: 'study', label: 'Study' },
  { id: 'pyq', label: 'PYQs' },
  { id: 'practice', label: 'Practice' },
];

export default function SidePanel({
  captures, activeId, onPick, onRemove, onClear,
  profiles, profile, onSwitchProfile, onEditProfiles,
  tab, onTab, getRun, onRun, onCancel, width,
  mode = 'notes', onMode, chatView,
}) {
  const active = captures.find((c) => c.id === activeId);
  return (
    <aside className="panel" aria-label="StudyLens panel" style={width ? { width } : undefined}>
      <div className="modes" role="group" aria-label="Panel mode">
        <button aria-pressed={mode === 'notes'} onClick={() => onMode('notes')}>Notes</button>
        <button aria-pressed={mode === 'ask'} onClick={() => onMode('ask')}>Ask doubts</button>
      </div>
      {mode === 'ask' ? chatView : (
        <>
      <div className="switcher">
        <label>Study structure
          <select value={profile.id} onChange={(e) => onSwitchProfile(e.target.value)}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <button onClick={onEditProfiles}>Edit structures</button>
      </div>
      <StructurePreview profile={profile} />

      <h2>Selected text</h2>
      {active ? (
        <section>
          <blockquote data-testid="active-text">{active.text}</blockquote>
          <p className="meta">
            {active.page ? `Page ${active.page}` : 'Page unknown'} · {countWords(active.text)} words
          </p>
          <div role="tablist" className="tabs" aria-label="Result type">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <RunView
            key={`${active.id}:${tab}`} action={tab} run={getRun(active.id, tab)}
            onRun={() => onRun(tab)} onCancel={() => onCancel(tab)}
          />
        </section>
      ) : (
        <p className="empty">Select text in the PDF, right-click, and choose what StudyLens should do with it.</p>
      )}

      {captures.length > 0 && (
        <section>
          <div className="row">
            <h3>Earlier selections</h3>
            <button className="link" onClick={onClear}>Clear all</button>
          </div>
          <ul className="history">
            {captures.map((c) => (
              <li key={c.id} className={c.id === activeId ? 'on' : ''}>
                <button className="pick" onClick={() => onPick(c.id)}>
                  <span className="pg">{c.page ? `p. ${c.page}` : '—'}</span>
                  <span className="snip">{c.text}</span>
                </button>
                <button className="link" aria-label="Remove selection" onClick={() => onRemove(c.id)}>Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}
        </>
      )}
    </aside>
  );
}
