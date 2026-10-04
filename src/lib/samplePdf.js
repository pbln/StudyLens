// Builds a small multi-page PDF in memory so the app can be tried without a file.
const esc = (s) => s.replace(/[\\()]/g, '\\$&');

export const SAMPLE_PAGES = [
  ['Chapter 1: Photosynthesis', '', 'Photosynthesis is the process by which green plants convert light energy',
   'into chemical energy stored in glucose. It takes place in the chloroplasts.', '',
   'The overall reaction is: 6CO2 + 6H2O + light -> C6H12O6 + 6O2.'],
  ['Light reactions', '', 'The light reactions occur in the thylakoid membranes. Water is split,',
   'oxygen is released, and ATP and NADPH are produced.', '',
   'The Calvin cycle then uses ATP and NADPH to fix carbon dioxide into sugar.'],
  ['Factors affecting the rate', '', 'Light intensity, carbon dioxide concentration and temperature all',
   'limit the rate of photosynthesis. Blackman proposed the law of limiting factors.'],
];

export function buildPdf(pages = SAMPLE_PAGES) {
  const objs = [];
  const n = pages.length;
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((lines, i) => {
    const body = lines.map((l, j) => `BT /F1 ${j === 0 ? 18 : 12} Tf 56 ${740 - j * 22} Td (${esc(l)}) Tj ET`).join('\n');
    objs[4 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objs[5 + i * 2] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  });
  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}
