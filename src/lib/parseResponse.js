export class ParseError extends Error {}

/** Pulls one JSON object out of a model reply, tolerating fences and surrounding prose. */
export function extractJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new ParseError('The reply was empty.');
  const s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(s); } catch { /* fall through to scanning */ }
  const start = s.indexOf('{');
  if (start < 0) throw new ParseError('The reply contained no JSON object.');
  let depth = 0; let inStr = false; let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch { throw new ParseError('The reply contained malformed JSON.'); }
    }
  }
  throw new ParseError('The reply JSON was cut off.');
}

const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export function validatePractice(obj) {
  if (!Array.isArray(obj?.questions)) throw new ParseError('The reply has no "questions" list.');
  const questions = [];
  const problems = [];
  obj.questions.forEach((q, i) => {
    const question = str(q?.question);
    const explanation = str(q?.explanation);
    if (!question) return problems.push(`Question ${i + 1} has no text.`);
    if (q.type === 'mcq') {
      const options = (Array.isArray(q.options) ? q.options : []).map(str).filter(Boolean).slice(0, 4);
      let idx = Number.isInteger(q.answerIndex) ? q.answerIndex : -1;
      if (idx < 0 && typeof q.answer === 'string') idx = options.findIndex((o) => o.toLowerCase() === q.answer.trim().toLowerCase());
      if (options.length < 2 || idx < 0 || idx >= options.length) return problems.push(`Question ${i + 1} has invalid options or answerIndex.`);
      questions.push({ type: 'mcq', question, options, answerIndex: idx, explanation });
    } else if (str(q?.answer)) {
      questions.push({ type: 'short', question, answer: str(q.answer), explanation });
    } else {
      problems.push(`Question ${i + 1} has no answer.`);
    }
  });
  if (!questions.length) problems.push('No usable questions were returned.');
  return { questions, problems: questions.length ? [] : problems, skipped: problems.length };
}
