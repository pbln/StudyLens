import { useCallback, useEffect, useState } from 'react';
import { readSelection } from '../lib/selection.js';

/**
 * Opens a custom context menu when the user right-clicks while text is selected
 * inside `containerRef`. With no selection the browser's own menu is left alone.
 */
export default function useSelectionMenu(containerRef) {
  const [menu, setMenu] = useState(null); // { x, y, text, page }
  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onContext = (e) => {
      const info = readSelection();
      if (!info) return setMenu(null);
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY, ...info });
    };
    el.addEventListener('contextmenu', onContext);
    return () => el.removeEventListener('contextmenu', onContext);
  }, [containerRef]);

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    const onDown = (e) => !e.target.closest?.('[data-studylens-menu]') && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [menu, close]);

  return { menu, close };
}
