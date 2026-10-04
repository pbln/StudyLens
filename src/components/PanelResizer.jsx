import { useRef, useState } from 'react';

export const MIN_WIDTH = 280;
const maxWidth = () => Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.75));
const clamp = (w) => Math.min(maxWidth(), Math.max(MIN_WIDTH, Math.round(w)));

/** Drag handle between the reader and the side panel. Also works with the arrow keys. */
export default function PanelResizer({ width = 340, onChange }) {
  const [drag, setDrag] = useState(false);
  const start = useRef(null);

  const down = (e) => {
    start.current = { x: e.clientX, w: width };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag(true);
  };
  const move = (e) => {
    if (!start.current) return;
    onChange(clamp(start.current.w + (start.current.x - e.clientX))); // dragging left makes the panel wider
  };
  const up = () => { start.current = null; setDrag(false); };
  const key = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(clamp(width + 24)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(clamp(width - 24)); }
  };

  return (
    <div
      className={`panel-resizer${drag ? ' drag' : ''}`} role="separator" aria-orientation="vertical"
      aria-label="Resize side panel" aria-valuenow={width} aria-valuemin={MIN_WIDTH} tabIndex={0}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
    />
  );
}
