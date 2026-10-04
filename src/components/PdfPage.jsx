import { useEffect, useRef, useState } from 'react';
import { pdfjs } from '../lib/pdf.js';

/** One PDF page: canvas for pixels, text layer for selectable text. Renders only when near the viewport. */
export default function PdfPage({ pdf, pageNumber, scale }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const [page, setPage] = useState(null);
  const [size, setSize] = useState({ w: 612 * scale, h: 792 * scale });
  const [near, setNear] = useState(false);

  useEffect(() => {
    let live = true;
    pdf.getPage(pageNumber).then((p) => {
      if (!live) return;
      const v = p.getViewport({ scale });
      setPage(p);
      setSize({ w: v.width, h: v.height });
    });
    return () => { live = false; };
  }, [pdf, pageNumber, scale]);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '800px 0px' });
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !page) return undefined;
    const viewport = page.getViewport({ scale });
    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.current;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    const task = page.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    });
    task.promise.catch(() => {});
    textRef.current.replaceChildren();
    const textLayer = new pdfjs.TextLayer({
      textContentSource: page.streamTextContent(),
      container: textRef.current,
      viewport,
    });
    textLayer.render().catch(() => {});
    return () => { task.cancel(); textLayer.cancel(); };
  }, [near, page, scale]);

  return (
    <div
      ref={wrapRef}
      className="pdf-page"
      data-page={pageNumber}
      style={{ width: size.w, height: size.h, '--scale-factor': scale, '--total-scale-factor': scale }}
    >
      <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} />
      <div ref={textRef} className="textLayer" />
    </div>
  );
}
