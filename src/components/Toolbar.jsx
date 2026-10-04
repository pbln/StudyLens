import { useRef } from 'react';

export default function Toolbar({
  fileName, page, numPages, scale, panelOpen,
  onOpenFile, onGoTo, onZoom, onTogglePanel, onOpenSettings,
}) {
  const input = useRef(null);
  const hasDoc = numPages > 0;
  return (
    <header className="toolbar">
      <span className="brand">StudyLens</span>
      <button onClick={() => input.current.click()}>Open PDF</button>
      <input
        ref={input} type="file" accept="application/pdf" hidden aria-label="PDF file"
        onChange={(e) => { const f = e.target.files[0]; if (f) onOpenFile(f); e.target.value = ''; }}
      />
      <span className="file-name" title={fileName}>{fileName}</span>

      <nav className="nav" aria-label="Page navigation">
        <button aria-label="Previous page" disabled={!hasDoc || page <= 1} onClick={() => onGoTo(page - 1)}>‹</button>
        <input
          aria-label="Page number" type="number" min="1" max={numPages || 1} disabled={!hasDoc}
          value={hasDoc ? page : ''} onChange={(e) => e.target.value && onGoTo(Number(e.target.value))}
        />
        <span>of {numPages || '–'}</span>
        <button aria-label="Next page" disabled={!hasDoc || page >= numPages} onClick={() => onGoTo(page + 1)}>›</button>
      </nav>

      <div className="zoom" role="group" aria-label="Zoom">
        <button aria-label="Zoom out" disabled={!hasDoc || scale <= 0.5} onClick={() => onZoom(-0.25)}>−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button aria-label="Zoom in" disabled={!hasDoc || scale >= 3} onClick={() => onZoom(0.25)}>+</button>
      </div>

      <button aria-pressed={panelOpen} onClick={onTogglePanel}>Side panel</button>
      <button onClick={onOpenSettings}>Settings</button>
    </header>
  );
}
