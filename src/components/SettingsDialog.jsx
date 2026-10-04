import { useState } from 'react';

export default function SettingsDialog({ settings, onChange, onClose, pyq }) {
  const [pyqMsg, setPyqMsg] = useState('');
  const importFile = async (file) => {
    try {
      const { count, skipped } = pyq.importText(await file.text());
      setPyqMsg(`Loaded ${count} questions${skipped ? ` (${skipped} skipped for missing fields)` : ''}.`);
    } catch (e) {
      setPyqMsg(e.message);
    }
  };
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="dialog settings" role="dialog" aria-label="Settings" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <label>
          Default zoom
          <select value={settings.defaultZoom} onChange={(e) => onChange({ defaultZoom: Number(e.target.value) })}>
            {[0.75, 1, 1.25, 1.5, 2].map((z) => <option key={z} value={z}>{z * 100}%</option>)}
          </select>
        </label>
        <label>
          Side panel text size
          <select value={settings.panelTextSize} onChange={(e) => onChange({ panelTextSize: e.target.value })}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.autoOpenPanel} onChange={(e) => onChange({ autoOpenPanel: e.target.checked })} />
          Open the side panel when I send text
        </label>

        <h3>AI model</h3>
        <label>
          Model source
          <select value={settings.provider} onChange={(e) => onChange({ provider: e.target.value })}>
            <option value="ollama">Gemma on this computer (Ollama)</option>
            <option value="google">Gemma via Google AI Studio</option>
            <option value="demo">Demo mode (no AI model)</option>
          </select>
        </label>
        {settings.provider === 'ollama' && (
          <>
            <label>Ollama address
              <input value={settings.ollamaUrl} onChange={(e) => onChange({ ollamaUrl: e.target.value })} />
            </label>
            <label>Model
              <input value={settings.ollamaModel} onChange={(e) => onChange({ ollamaModel: e.target.value })} />
            </label>
            <p className="meta">Install with “ollama pull {settings.ollamaModel}”.</p>
          </>
        )}
        {settings.provider === 'google' && (
          <>
            <label>Model
              <input value={settings.googleModel} onChange={(e) => onChange({ googleModel: e.target.value })} />
            </label>
            <label>API key
              <input type="password" autoComplete="off" value={settings.googleKey} onChange={(e) => onChange({ googleKey: e.target.value })} />
            </label>
            <p className="meta">The key is saved in this browser only and sent only to Google. Don’t use this on a shared computer.</p>
          </>
        )}
        {settings.provider === 'demo' && (
          <p className="meta">Demo mode builds notes from your text with simple rules, so you can try the layout without Gemma. It does not explain anything.</p>
        )}

        <h3>Previous-year questions</h3>
        <p className="meta">
          {pyq.entries.length ? `${pyq.entries.length} questions loaded.` : 'No question bank loaded.'}
          {' '}Import a JSON list where each item has “question”, “exam” and “year” (optional: options, answer, paper, subject, topic, source).
        </p>
        <div className="row">
          <label className="filebtn">
            Import PYQ file
            <input type="file" accept="application/json,.json" hidden aria-label="PYQ file"
              onChange={(e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; }} />
          </label>
          {pyq.entries.length > 0 && <button className="link" onClick={() => { pyq.clear(); setPyqMsg('Question bank cleared.'); }}>Clear bank</button>}
        </div>
        {pyqMsg && <p className="meta" role="status">{pyqMsg}</p>}

        <button className="primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
