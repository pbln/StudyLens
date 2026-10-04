import { useEffect, useMemo, useRef } from 'react';
import PdfPage from './PdfPage.jsx';

/** Scrollable stack of pages. `jump` = { n, k } scrolls to page n (k makes repeat jumps distinct). */
export default function PdfViewer({ pdf, scale, jump, onPageChange }) {
  const ref = useRef(null);
  const frame = useRef(0);
  const pages = useMemo(() => Array.from({ length: pdf.numPages }, (_, i) => i + 1), [pdf]);

  useEffect(() => {
    if (jump) ref.current?.querySelector(`[data-page="${jump.n}"]`)?.scrollIntoView({ block: 'start' });
  }, [jump]);

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const top = ref.current.getBoundingClientRect().top + 120;
      for (const el of ref.current.querySelectorAll('[data-page]')) {
        if (el.getBoundingClientRect().bottom > top) return onPageChange?.(Number(el.dataset.page));
      }
    });
  };

  return (
    <div className="viewer" ref={ref} onScroll={onScroll}>
      {pages.map((n) => <PdfPage key={n} pdf={pdf} pageNumber={n} scale={scale} />)}
    </div>
  );
}
