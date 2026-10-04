// @vitest-environment node
// Real HTTP round trip: the Ollama provider talks to a local server that speaks Ollama's /api/chat format
// and answers with the demo model. Proves the wire format and the full pipeline end to end (not Gemma itself).
import http from 'node:http';
import { demoProvider } from './demoProvider.js';
import { ollamaProvider } from './providers.js';
import { runAction } from '../pipeline.js';
import { BUILT_INS } from '../profileSchema.js';

let server; let baseUrl; let seen = [];
beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    const body = JSON.parse(raw);
    seen.push({ url: req.url, body });
    const content = await demoProvider.generate(body.messages[0].content);
    if (body.stream) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      for (let i = 0; i < content.length; i += 25) res.write(`${JSON.stringify({ message: { content: content.slice(i, i + 25) }, done: false })}\n`);
      res.end(`${JSON.stringify({ message: { content: '' }, done: true })}\n`);
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ model: body.model, message: { role: 'assistant', content }, done: true }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => server.close());

it('streams study notes over real HTTP and they match the profile', async () => {
  const text = 'The light reactions occur in the thylakoid membranes. Water is split and oxygen is released.';
  const provider = ollamaProvider({ baseUrl, model: 'gemma4:e4b' });
  const partials = [];
  const r = await runAction({ action: 'study', text, profile: BUILT_INS[0], provider, onPartial: (p) => partials.push(p.markdown) });
  expect(seen[0].body.stream).toBe(true);
  expect(partials.length).toBeGreaterThan(1);
  expect(r.markdown.startsWith(partials[0])).toBe(true);
  expect(r.meta.check.ok).toBe(true);
  expect(r.markdown).toMatch(/^## Topic \/ concept\n/);
  expect(r.markdown).toContain('thylakoid');
});
