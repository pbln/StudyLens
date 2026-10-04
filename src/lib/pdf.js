import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjs };

/** Load a PDF from a Uint8Array. Rejects for invalid or password-protected files. */
export function loadPdf(data) {
  return pdfjs.getDocument({ data }).promise;
}
