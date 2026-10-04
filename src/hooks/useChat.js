import { useCallback, useEffect, useRef, useState } from 'react';
import { buildChatPrompt } from '../lib/chat.js';

const PREFIX = 'studylens.chat.v1:';
const MAX_SAVED = 40;

function load(key) {
  if (!key) return [];
  try {
    const v = JSON.parse(localStorage.getItem(PREFIX + key));
    return Array.isArray(v) ? v.filter((m) => m && typeof m.text === 'string' && m.status !== 'streaming') : [];
  } catch { return []; }
}

/** One doubt-chat per PDF, remembered in this browser. `key` identifies the PDF (null = none open). */
export default function useChat(key) {
  const [state, setState] = useState(() => ({ key, messages: load(key) }));
  const ref = useRef(state);
  const abort = useRef(null);
  const counter = useRef(1);

  // Switching PDFs swaps the conversation during render, so the save effect below can never write one PDF's chat to another.
  let current = state;
  if (state.key !== key) {
    abort.current?.abort();
    current = { key, messages: load(key) };
    setState(current);
  }
  ref.current = current;

  useEffect(() => {
    if (!current.key || current.messages.some((m) => m.status === 'streaming')) return;
    try { localStorage.setItem(PREFIX + current.key, JSON.stringify(current.messages.slice(-MAX_SAVED))); } catch { /* storage unavailable */ }
  }, [current]);

  const patch = (id, change) => setState((s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? { ...m, ...change } : m)) }));

  const send = useCallback(async ({ question, ctx, provider, profile }) => {
    const history = ref.current.messages;
    const stamp = Date.now();
    const user = { id: `${stamp}-${counter.current++}`, role: 'user', text: question, page: ctx.page, pinned: ctx.pinned?.text ?? null, status: 'done' };
    const bot = { id: `${stamp}-${counter.current++}`, role: 'assistant', text: '', status: 'streaming' };
    const ac = new AbortController();
    abort.current?.abort();
    abort.current = ac;
    setState((s) => ({ ...s, messages: [...s.messages, user, bot] }));
    try {
      const prompt = buildChatPrompt({ question, page: ctx.page, pageText: ctx.pageText, pinned: ctx.pinned, history, profile });
      const text = await provider.generate(prompt, { signal: ac.signal, onText: (t) => patch(bot.id, { text: t }) });
      patch(bot.id, { text: text || '', status: 'done' });
    } catch (e) {
      if (ac.signal.aborted) patch(bot.id, { status: 'stopped' });
      else patch(bot.id, { status: 'error', error: e.message || 'Something went wrong.' });
    }
  }, []);

  const stop = useCallback(() => abort.current?.abort(), []);

  /** Removes the last question and its failed or stopped answer, and returns the question so it can be asked again. */
  const dropLast = useCallback(() => {
    const msgs = ref.current.messages;
    const last = msgs[msgs.length - 1];
    const asked = msgs[msgs.length - 2];
    if (!last || last.role !== 'assistant' || asked?.role !== 'user') return null;
    setState((s) => ({ ...s, messages: s.messages.slice(0, -2) }));
    return asked;
  }, []);

  const clear = useCallback(() => {
    abort.current?.abort();
    setState((s) => ({ ...s, messages: [] }));
  }, []);

  return { messages: current.messages, busy: current.messages.some((m) => m.status === 'streaming'), send, stop, dropLast, clear };
}
