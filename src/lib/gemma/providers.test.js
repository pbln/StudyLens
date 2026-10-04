import { googleProvider, ollamaProvider, ProviderError, resetGoogleHealth } from './providers.js';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const status = (s) => ({ ok: false, status: s, json: async () => ({}) });

describe('ollamaProvider', () => {
  it('sends a plain chat request with a larger context and returns the text', async () => {
    const f = vi.fn(async () => ok({ message: { content: '{"x":1}' } }));
    const out = await ollamaProvider({ baseUrl: 'http://h:1/', model: 'gemma4:e4b' }, f).generate('PROMPT');
    expect(out).toBe('{"x":1}');
    const [url, init] = f.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe('http://h:1/api/chat');
    expect(body).toMatchObject({ model: 'gemma4:e4b', stream: false, messages: [{ role: 'user', content: 'PROMPT' }] });
    expect(body.format).toBeUndefined();
    expect(body.options.num_ctx).toBeGreaterThanOrEqual(8192);
  });
  it('explains unreachable server, missing model and empty reply', async () => {
    const mk = (f) => ollamaProvider({ baseUrl: 'http://h', model: 'm' }, f).generate('p');
    await expect(mk(async () => { throw new TypeError('fail'); })).rejects.toMatchObject({ code: 'unreachable' });
    await expect(mk(async () => status(404))).rejects.toMatchObject({ code: 'no_model' });
    await expect(mk(async () => ok({ message: {} }))).rejects.toMatchObject({ code: 'empty' });
  });
  it('lets aborts through untouched', async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    await expect(ollamaProvider({ baseUrl: 'http://h', model: 'm' }, async () => { throw abort; }).generate('p')).rejects.toBe(abort);
  });
});

describe('googleProvider', () => {
  it('calls generateContent with the key in a header and joins text parts', async () => {
    const f = vi.fn(async () => ok({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: '{"a":' }, { text: '1}' }] } }] }));
    const out = await googleProvider({ apiKey: 'K', model: 'gemma-4-31b-it' }, f).generate('PROMPT');
    expect(out).toBe('{"a":1}');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent');
    expect(init.headers['x-goog-api-key']).toBe('K');
    expect(url).not.toContain('K=');
    expect(JSON.parse(init.body).contents[0].parts[0].text).toBe('PROMPT');
  });
  it('maps errors to friendly codes', async () => {
    const mk = (f, key = 'K') => googleProvider({ apiKey: key, model: 'm' }, f).generate('p');
    await expect(mk(async () => ok({}), '')).rejects.toMatchObject({ code: 'no_key' });
    await expect(mk(async () => status(403))).rejects.toMatchObject({ code: 'auth' });
    await expect(mk(async () => status(429))).rejects.toMatchObject({ code: 'rate' });
    await expect(mk(async () => ok({ candidates: [] }))).rejects.toBeInstanceOf(ProviderError);
  });
  it('retries a 500 and succeeds, and explains a persistent one', async () => {
    const good = ok({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] });
    const f1 = vi.fn().mockResolvedValueOnce(status(500)).mockResolvedValueOnce(good);
    expect(await googleProvider({ apiKey: 'K', model: 'm' }, f1, { retryDelayMs: 1 }).generate('p')).toBe('hi');
    expect(f1).toHaveBeenCalledTimes(2);
    const f2 = vi.fn(async () => status(500));
    await expect(googleProvider({ apiKey: 'K', model: 'm' }, f2, { retryDelayMs: 1 }).generate('p')).rejects.toMatchObject({ code: 'http' });
    expect(f2).toHaveBeenCalledTimes(3);
  });
  it('asks for minimal thinking, and retries without it if Google rejects that', async () => {
    const good = ok({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] });
    const bad = { ok: false, status: 400, text: async () => '', json: async () => ({ error: { message: 'Thinking level is not supported for this model.' } }), clone() { return this; } };
    const f = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(good);
    expect(await googleProvider({ apiKey: 'K', model: 'gemma-4-31b-it' }, f, { retryDelayMs: 1 }).generate('p')).toBe('hi');
    expect(JSON.parse(f.mock.calls[0][1].body).generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'MINIMAL' });
    expect(JSON.parse(f.mock.calls[1][1].body).generationConfig.thinkingConfig).toBeUndefined();
  });
  it('uses the right thinking setting per model family', async () => {
    const run = async (model) => {
      const f = vi.fn(async () => ok({ candidates: [{ content: { parts: [{ text: 'x' }] } }] }));
      await googleProvider({ apiKey: 'K', model }, f).generate('p');
      return JSON.parse(f.mock.calls[0][1].body).generationConfig.thinkingConfig;
    };
    expect(await run('gemini-3.8-flash')).toEqual({ thinkingLevel: 'MINIMAL' });
    expect(await run('gemini-2.5-flash')).toEqual({ thinkingBudget: 0 });
    expect(await run('some-other-model')).toBeUndefined();
  });
  it('streams: calls onText with the text so far and returns the full text', async () => {
    const enc = new TextEncoder();
    const sse = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"lo"}]}}],"usageMetadata":{"candidatesTokenCount":2}}\n\n',
    ];
    let i = 0;
    const res = { ok: true, status: 200, body: { getReader: () => ({ read: async () => (i < sse.length ? { done: false, value: enc.encode(sse[i++]) } : { done: true }) }) } };
    const f = vi.fn(async () => res);
    const seen = [];
    const out = await googleProvider({ apiKey: 'K', model: 'gemma-4-31b-it' }, f).generate('p', { onText: (t) => seen.push(t) });
    expect(out).toBe('Hello');
    expect(seen).toEqual(['Hel', 'Hello']);
    expect(f.mock.calls[0][0]).toContain(':streamGenerateContent?alt=sse');
  });
  it('falls back to the lighter model when Google keeps failing on the chosen one', async () => {
    const good = ok({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] });
    const f = vi.fn(async (url) => (url.includes('gemma-4-31b-it') ? status(500) : good));
    const out = await googleProvider({ apiKey: 'K', model: 'gemma-4-31b-it', fallbackModel: 'gemma-4-26b-a4b-it' }, f, { retryDelayMs: 1 }).generate('p');
    expect(out).toBe('hi');
    expect(f.mock.calls.filter(([u]) => u.includes('gemma-4-26b-a4b-it'))).toHaveLength(1);
  });
});

describe('ollamaProvider streaming', () => {
  const ndjson = (lines) => ({
    ok: true, status: 200,
    body: new ReadableStream({ start(c) { const e = new TextEncoder(); lines.forEach((l) => c.enqueue(e.encode(l))); c.close(); } }),
  });
  it('streams text to onText, tolerates split lines, and only forces JSON when asked', async () => {
    const f = vi.fn(async () => ndjson(['{"message":{"content":"## To"}}\n{"message":{"con', 'tent":"pic"}}\n{"done":true}\n']));
    const seen = [];
    const out = await ollamaProvider({ baseUrl: 'http://h', model: 'm' }, f).generate('P', { onText: (t) => seen.push(t) });
    expect(out).toBe('## Topic');
    expect(seen).toEqual(['## To', '## Topic']);
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
    expect(body.format).toBeUndefined();
    await ollamaProvider({ baseUrl: 'http://h', model: 'm' }, vi.fn(async () => ok({ message: { content: '{}' } }))).generate('P', { json: true });
  });
  it('asks for JSON format when json is set', async () => {
    const f = vi.fn(async () => ok({ message: { content: '{}' } }));
    await ollamaProvider({ baseUrl: 'http://h', model: 'm' }, f).generate('P', { json: true });
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ stream: false, format: 'json' });
  });
});

describe('googleProvider speed rules (slow or failing 31B)', () => {
  const good = () => ok({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] });
  const big = 'gemma-4-31b-it';
  const light = 'gemma-4-26b-a4b-it';
  const used = (f, m) => f.mock.calls.filter(([u]) => u.includes(m)).length;
  beforeEach(() => resetGoogleHealth());

  it('with a fallback, a 500 gets ONE attempt on the big model, then switches immediately', async () => {
    const f = vi.fn(async (u) => (u.includes(big) ? status(500) : good()));
    const t0 = Date.now();
    expect(await googleProvider({ apiKey: 'K', model: big, fallbackModel: light }, f, { retryDelayMs: 5000 }).generate('p')).toBe('hi');
    expect(used(f, big)).toBe(1);
    expect(used(f, light)).toBe(1);
    expect(Date.now() - t0).toBeLessThan(1000); // no waiting between retries
  });

  it('switches to the fallback when no text arrives before the deadline', async () => {
    const f = vi.fn((u, init) => (u.includes(big)
      ? new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' }))))
      : Promise.resolve(good())));
    const out = await googleProvider({ apiKey: 'K', model: big, fallbackModel: light }, f, { firstTokenMs: 30, requestMs: 30 }).generate('p');
    expect(out).toBe('hi');
    expect(used(f, light)).toBe(1);
  });

  it('remembers the struggling model: the next request goes straight to the fallback', async () => {
    const f = vi.fn(async (u) => (u.includes(big) ? status(500) : good()));
    const p = googleProvider({ apiKey: 'K', model: big, fallbackModel: light }, f);
    await p.generate('one');
    await p.generate('two');
    expect(used(f, big)).toBe(1);
    expect(used(f, light)).toBe(2);
  });

  it('tries the big model again after the cool-down', async () => {
    let t = 0;
    const f = vi.fn(async (u) => (u.includes(big) ? status(500) : good()));
    const p = googleProvider({ apiKey: 'K', model: big, fallbackModel: light }, f, { healthMs: 1000, now: () => t });
    await p.generate('one');
    t = 2000;
    await p.generate('two');
    expect(used(f, big)).toBe(2);
  });

  it('the user pressing Stop is not treated as slowness', async () => {
    const ac = new AbortController();
    const f = vi.fn((u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' })))));
    const p = googleProvider({ apiKey: 'K', model: big, fallbackModel: light }, f, { firstTokenMs: 5000 });
    const run = p.generate('p', { signal: ac.signal });
    ac.abort();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(used(f, light)).toBe(0);
    // and it did not mark the big model as unhealthy
    await expect(googleProvider({ apiKey: 'K', model: big, fallbackModel: light }, vi.fn(async () => good())).generate('p')).resolves.toBe('hi');
  });

  it('a fast first token cancels the deadline and the big model is used normally', async () => {
    const sse = (t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`;
    const f = vi.fn(async () => ({ ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(sse('Hel') + sse('lo'))); c.close(); } }) }));
    const seen = [];
    const out = await googleProvider({ apiKey: 'K', model: big, fallbackModel: light }, f, { firstTokenMs: 50 }).generate('p', { onText: (x) => seen.push(x) });
    expect(out).toBe('Hello');
    await new Promise((r) => setTimeout(r, 80));
    expect(used(f, light)).toBe(0);
  });

  it('without a fallback it still retries 500s on the same model', async () => {
    const f = vi.fn(async () => status(500));
    await expect(googleProvider({ apiKey: 'K', model: light }, f, { retryDelayMs: 1 }).generate('p')).rejects.toMatchObject({ code: 'http' });
    expect(f).toHaveBeenCalledTimes(3);
  });
});