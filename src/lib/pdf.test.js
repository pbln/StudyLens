// @vitest-environment node
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildPdf } from './samplePdf.js';

describe('PDF opens correctly', () => {
  it('parses the sample, with 3 pages and extractable text', async () => {
    const pdf = await getDocument({ data: buildPdf(), isEvalSupported: false }).promise;
    expect(pdf.numPages).toBe(3);
    const page = await pdf.getPage(1);
    const { items } = await page.getTextContent();
    const text = items.map((i) => i.str).join(' ');
    expect(text).toContain('Photosynthesis is the process');
  });

  it('rejects a file that is not a PDF', async () => {
    const bad = new TextEncoder().encode('hello, not a pdf');
    await expect(getDocument({ data: bad, isEvalSupported: false }).promise).rejects.toBeTruthy();
  });
});
