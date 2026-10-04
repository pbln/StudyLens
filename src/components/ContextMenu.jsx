import { countWords } from '../lib/selection.js';

export const ACTIONS = [
  { id: 'study', label: 'Explain / Study this', primary: true },
  { id: 'pyq', label: 'Find actual PYQs' },
  { id: 'practice', label: 'Generate practice questions' },
];

export default function ContextMenu({ menu, onAction, onAsk, onCopy }) {
  const left = Math.min(menu.x, window.innerWidth - 250);
  const top = Math.min(menu.y, window.innerHeight - 230);
  const words = countWords(menu.text);
  return (
    <div className="ctx-menu" role="menu" data-studylens-menu style={{ left, top }}>
      <div className="ctx-hint">{words} {words === 1 ? 'word' : 'words'} selected</div>
      {ACTIONS.map((a) => (
        <button key={a.id} role="menuitem" className={a.primary ? 'primary' : ''} onClick={() => onAction(a.id)}>{a.label}</button>
      ))}
      {onAsk && <button role="menuitem" onClick={onAsk}>Ask a doubt about this</button>}
      <button role="menuitem" onClick={onCopy}>Copy text</button>
    </div>
  );
}
