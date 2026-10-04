import { cleanText } from './selection.js';

/** Plain text of one PDF page (1-based). Returns '' if the page can't be read, so a chat never breaks on it. */
export async function getPageText(pdf, n) {
  try {
    const page = await pdf.getPage(n);
    const { items } = await page.getTextContent();
    let out = '';
    for (const it of items) out += `${it.str ?? ''}${it.hasEOL ? '\n' : ' '}`;
    return cleanText(out);
  } catch {
    return '';
  }
}
