// Retrieval over a user-supplied bank of real previous-year questions. Nothing here is generated.
const STOP = new Set(('the and for are was were with that this these those from which what when where how why can may will ' +
  'not has have had its into than then there their such also been being does did but all any each one two').split(' '));

const stem = (t) => (/^[a-z]+$/.test(t) && t.length > 4 ? t.replace(/(ing|ed|es|s)$/, '') : t);
export function tokenize(s) {
  return (String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((t) => t.length > 2 && !STOP.has(t)).map(stem);
}

/** Keeps entries that have question, exam and year; fills every optional field so later code can rely on shape. */
export function normalizeEntries(list) {
  const entries = [];
  list.forEach((q, i) => {
    const year = Number(q?.year);
    if (!q || typeof q.question !== 'string' || !q.question.trim() || typeof q.exam !== 'string' || !q.exam.trim() || !Number.isFinite(year)) return;
    entries.push({
      id: String(q.id ?? `pyq-${i}`), exam: q.exam.trim(), year, question: q.question.trim(),
      paper: typeof q.paper === 'string' ? q.paper : '', subject: typeof q.subject === 'string' ? q.subject : '',
      topic: typeof q.topic === 'string' ? q.topic : '', source: typeof q.source === 'string' ? q.source : '',
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      answer: q.answer == null ? '' : String(q.answer), tags: Array.isArray(q.tags) ? q.tags.map(String) : [],
    });
  });
  return entries;
}

/** Accepts a JSON array (or { questions: [...] }). */
export function parsePyqBank(jsonText) {
  let raw;
  try { raw = JSON.parse(jsonText); } catch { throw new Error('That file is not valid JSON.'); }
  const list = Array.isArray(raw) ? raw : raw?.questions;
  if (!Array.isArray(list)) throw new Error('Expected a list of questions.');
  const entries = normalizeEntries(list);
  return { entries, skipped: list.length - entries.length };
}

function rank(bank, queryTokens) {
  const docs = bank.map((e) => new Set(tokenize([e.question, e.topic, e.subject, ...e.tags, ...e.options].join(' '))));
  const df = new Map();
  docs.forEach((d) => d.forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const need = queryTokens.size <= 3 ? 1 : 2;
  return bank.map((entry, i) => {
    const matched = [...queryTokens].filter((t) => docs[i].has(t));
    const score = matched.reduce((s, t) => s + Math.log(1 + bank.length / df.get(t)), 0);
    return { entry, score, matched };
  }).filter((r) => r.matched.length >= need).sort((a, b) => b.score - a.score);
}

/** Matches by keyword overlap with the selected text, filtered to the target exam when one is set. */
export function searchPyqs(bank, text, { exam = 'None', limit = 8 } = {}) {
  const queryTokens = new Set(tokenize(text).slice(0, 300));
  const all = rank(bank, queryTokens);
  const sameExam = (e) => exam === 'None' || e.exam.toLowerCase() === exam.toLowerCase();
  const matches = all.filter((r) => sameExam(r.entry)).slice(0, limit);
  return { matches, otherExam: all.filter((r) => !sameExam(r.entry)).length };
}
