export class ProviderError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const jsonPost = (body, headers = {}) => ({
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

/** Ollama streams one JSON object per line; text arrives in message.content. */
async function readNdjson(res, onText) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = ''; let text = '';
  const take = (line) => {
    if (!line.trim()) return;
    let j; try { j = JSON.parse(line); } catch { return; }
    const add = j?.message?.content;
    if (add) { text += add; onText(text); }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    lines.forEach(take);
  }
  take(buf);
  return text;
}

/** Local Gemma through Ollama. num_ctx is raised because Ollama's default context for Gemma 4 is only 4K. */
export function ollamaProvider({ baseUrl, model }, fetchImpl = (...a) => fetch(...a)) {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    id: 'ollama',
    label: `Gemma (${model}, Ollama)`,
    async generate(prompt, { signal, onText, json } = {}) {
      const stream = typeof onText === 'function';
      let res;
      try {
        res = await fetchImpl(`${base}/api/chat`, {
          ...jsonPost({
            model, stream, ...(json ? { format: 'json' } : {}),
            messages: [{ role: 'user', content: prompt }],
            options: { temperature: 0.2, num_ctx: 8192 },
          }),
          signal,
        });
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw new ProviderError('unreachable', `Couldn’t reach Ollama at ${base}. Start Ollama and run “ollama pull ${model}”, or choose another model in Settings.`);
      }
      if (res.status === 404) throw new ProviderError('no_model', `Ollama doesn’t have “${model}”. Run “ollama pull ${model}”.`);
      if (!res.ok) throw new ProviderError('http', `Ollama returned an error (${res.status}).`);
      const text = stream ? await readNdjson(res, onText) : (await res.json())?.message?.content;
      if (!text) throw new ProviderError('empty', 'Gemma returned an empty reply.');
      return text;
    },
  };
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
});

/** Google's own explanation of a failed call, e.g. "Resource has been exhausted" or "Invalid JSON payload". */
async function googleReason(res) {
  try { return (await res.json())?.error?.message || ''; } catch { return ''; }
}

/** Which "thinking" setting each model family accepts. Thinking is the main source of delay, so keep it minimal. */
function thinkingFor(model) {
  const m = String(model).toLowerCase();
  if (m.startsWith('gemma-4') || m.startsWith('gemini-3')) return { thinkingLevel: 'MINIMAL' };
  if (m.startsWith('gemini-2.5') && !m.includes('pro')) return { thinkingBudget: 0 };
  return null;
}

/** Reads a streamGenerateContent SSE body, calling onText with all the text so far. Returns the final text and usage. */
async function readStream(res, onText, onFirst) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = ''; let text = ''; let usage = null;
  const take = (line) => {
    if (!line.startsWith('data:')) return;
    let chunk; try { chunk = JSON.parse(line.slice(5).trim()); } catch { return; }
    const cand = chunk?.candidates?.[0];
    const add = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
    if (add) { if (!text) onFirst?.(); text += add; onText(text); }
    if (chunk?.usageMetadata) usage = chunk.usageMetadata;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split(/\r?\n/); buf = lines.pop();
    lines.forEach(take);
  }
  if (buf) take(buf);
  return { text, usage };
}

// Remembers which model has been slow or failing, across requests, so one bad stretch costs a single wait.
const trouble = new Map(); // model -> time (ms) until which we skip it
export function resetGoogleHealth() { trouble.clear(); }

/** Gemma (or any Gemini model) on the Gemini API with a Google AI Studio key. Everything goes in one user message.
 *  Speed rules, because Google's hosted 31B model is often slow or returns 500s:
 *  - With a fallback model, the chosen model gets ONE attempt and a deadline (firstTokenMs to the first text when streaming,
 *    requestMs for a whole non-streamed reply). A 500/503 or a missed deadline switches to the fallback straight away.
 *  - A model that failed or was slow is skipped for healthMs, so the next requests go directly to the fallback.
 *  - Without a fallback, 500/503 are retried a couple of times as before.
 *  - Pass onText to stream: it is called with the text so far, so the UI can show notes as they are written. */
export function googleProvider(
  { apiKey, model, fallbackModel },
  fetchImpl = (...a) => fetch(...a),
  { retryDelayMs = 700, firstTokenMs = 12000, requestMs = 30000, healthMs = 5 * 60 * 1000, now = () => Date.now() } = {},
) {
  async function call(model, prompt, { signal, onText } = {}, { fast = false } = {}) {
    if (!apiKey) throw new ProviderError('no_key', 'Add your Google AI Studio API key in Settings.');
    const stream = typeof onText === 'function';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    const t0 = Date.now();
    const maxAttempts = fast ? 1 : 3;
    const deadline = fast ? (stream ? firstTokenMs : requestMs) : 0;
    let thinking = thinkingFor(model);
    let res;
    let ttft = null;

    // One controller covers the user's Stop button and our own deadline.
    const ac = new AbortController();
    const onUserAbort = () => ac.abort();
    if (signal?.aborted) ac.abort(); else signal?.addEventListener?.('abort', onUserAbort);
    let timedOut = false;
    let timer = null;
    const arm = () => { if (deadline) timer = setTimeout(() => { timedOut = true; ac.abort(); }, deadline); };
    const disarm = () => { if (timer) clearTimeout(timer); timer = null; };
    const slow = () => Object.assign(new ProviderError('slow', `${model} didn’t respond within ${Math.round(deadline / 1000)}s.`), { serverError: true });

    try {
      arm();
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt === 2) thinking = null; // last try: plain request, in case the thinking setting is what Google chokes on
        const body = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, ...(thinking ? { thinkingConfig: thinking } : {}) },
        };
        try {
          res = await fetchImpl(url, { ...jsonPost(body, { 'x-goog-api-key': apiKey }), signal: ac.signal });
        } catch (e) {
          if (e?.name === 'AbortError') { if (timedOut) throw slow(); throw e; }
          throw new ProviderError('unreachable', 'Couldn’t reach Google AI Studio. Check your connection.');
        }
        if (!res.ok) {
          // Debug log for the browser console (the API key is never printed).
          const b = typeof res.clone === 'function' ? await res.clone().text().catch(() => '') : '';
          console.error(`[StudyLens/Google] attempt ${attempt + 1}: HTTP ${res.status} for model "${model}", prompt ${prompt.length} chars. Response body:`, b || '(empty)');
        }
        if (res.status === 400 && thinking && typeof res.clone === 'function') {
          const why = await googleReason(res.clone());
          if (/thinking/i.test(why)) { thinking = null; attempt--; continue; }
        }
        if (res.status !== 500 && res.status !== 503) break;
        if (attempt < maxAttempts - 1) await sleep(retryDelayMs * (attempt + 1), ac.signal);
      }
      if (!res.ok) {
        const why = await googleReason(res);
        if (res.status === 401 || res.status === 403) throw new ProviderError('auth', 'Google rejected the API key. Check it in Settings.');
        if (res.status === 400) throw new ProviderError('auth', `Google rejected the request${why ? `: ${why}` : ''}. Check the API key and model name in Settings.`);
        if (res.status === 404) throw new ProviderError('no_model', `Google has no model called “${model}”. Check the name in Settings.`);
        if (res.status === 429) throw new ProviderError('rate', 'Google’s rate limit was hit. Wait a minute and try again, or switch to gemma-4-26b-a4b-it in Settings.');
        if (res.status === 500 || res.status === 503) {
          throw Object.assign(new ProviderError('http', `Google’s server had a problem (${res.status})${why ? `: ${why}` : ''}. Try again in a minute, or switch the model to gemma-4-26b-a4b-it in Settings.`), { serverError: true });
        }
        throw new ProviderError('http', `Google returned an error (${res.status}).`);
      }
      let text; let usage;
      if (stream) {
        ({ text, usage } = await readStream(res, onText, () => { ttft = Date.now() - t0; disarm(); }));
      } else {
        const data = await res.json();
        disarm();
        const cand = data?.candidates?.[0];
        text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
        usage = data?.usageMetadata;
      }
      console.info(`[StudyLens/Google] ${model}: ${((Date.now() - t0) / 1000).toFixed(1)}s total${ttft != null ? ` · first text ${(ttft / 1000).toFixed(1)}s` : ''} · prompt ${usage?.promptTokenCount ?? '?'} tok · thinking ${usage?.thoughtsTokenCount ?? 0} tok · output ${usage?.candidatesTokenCount ?? '?'} tok${stream ? ' · streamed' : ''}`);
      if (!text) throw new ProviderError('empty', 'The model returned no text (the reply may have been blocked).');
      return text;
    } catch (e) {
      if (e?.name === 'AbortError' && timedOut) throw slow(); // the deadline fired while reading the stream
      throw e;
    } finally {
      disarm();
      signal?.removeEventListener?.('abort', onUserAbort);
    }
  }

  async function request(prompt, opts) {
    const hasFallback = !!fallbackModel && fallbackModel !== model;
    if (hasFallback && (trouble.get(model) ?? 0) > now()) {
      console.warn(`[StudyLens/Google] ${model} was slow or failing recently, so using ${fallbackModel} for now.`);
      return call(fallbackModel, prompt, opts);
    }
    try {
      return await call(model, prompt, opts, { fast: hasFallback });
    } catch (e) {
      if (!hasFallback || !e?.serverError) throw e;
      trouble.set(model, now() + healthMs);
      console.warn(`[StudyLens/Google] ${model} failed or was too slow (${e.message}); switching to ${fallbackModel}.`);
      return call(fallbackModel, prompt, opts);
    }
  }

  return {
    id: 'google',
    label: `Gemma (${model}, Google AI Studio)`,
    generate: request,
  };
}