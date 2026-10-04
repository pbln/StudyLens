/** Collapse PDF line breaks into readable text. Joins words hyphenated across lines. */
export function cleanText(raw) {
  return raw
    .replace(/-\s*\n\s*/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t\u00a0]+/g, ' ')
    .trim();
}

export function countWords(text) {
  return text ? text.split(/\s+/).length : 0;
}

/** Returns { text, page } for the current selection, or null if nothing is selected. */
export function readSelection(sel = window.getSelection()) {
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const text = cleanText(sel.toString());
  if (!text) return null;
  const node = sel.anchorNode;
  const el = node && node.nodeType === 1 ? node : node?.parentElement;
  const pageEl = el?.closest?.('[data-page]');
  return { text, page: pageEl ? Number(pageEl.dataset.page) : null };
}
