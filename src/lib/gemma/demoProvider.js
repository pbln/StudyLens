// Offline stand-in for a model. It reads the *prompt* (headings, order, limits, text) and writes notes in the
// requested Markdown from the selected text alone, so the real prompt -> stream -> render path runs with no
// network. It is not Gemma and its notes are plain extracts, not explanations.
import { SECTIONS } from '../profileSchema.js';

const STOP = new Set(('the and for are was were with that this these those from which what when where how why can may will not has have had its ' +
  'into than then there their such also been being does did but all any each one two occur takes place').split(' '));
const ID_BY_LABEL = new Map(SECTIONS.map((s) => [s.label, s.id]));

const sentences = (t) => (t.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]?/g) || []).map((s) => s.trim()).filter((s) => s.length > 3);

function topTerms(text, n = 6) {
  const freq = new Map();
  (text.match(/[A-Za-z][A-Za-z-]{6,}/g) || []).forEach((w) => {
    const k = w.toLowerCase();
    if (!STOP.has(k)) freq.set(k, (freq.get(k) || 0) + 1);
  });
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, n).map(([w]) => w);
}

const grab = (prompt, re, fallback = '') => (prompt.match(re) || [, fallback])[1].trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const bullets = (a) => a.map((x) => `- ${x}`).join('\n');
const steps = (a) => a.map((x, i) => `${i + 1}. ${x}`).join('\n');

function study(prompt, text) {
  const head = prompt.slice(0, prompt.lastIndexOf('SELECTED TEXT\n<<<'));
  const labels = [...head.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  const max = Number(grab(head, /at most (\d+) items/, '6'));
  const depth = grab(head, /- Depth: (\w+)/, 'medium').toLowerCase();
  const exam = grab(head, /- Exam: (.+)/, 'none');
  const lim = { short: 3, medium: 6, detailed: 12 }[depth] ?? 6;
  const ss = sentences(text);
  const terms = topTerms(text);
  const def = (t) => ss.find((s) => s.toLowerCase().includes(t)) || ss[0] || t;
  const make = {
    topic: () => cap(terms[0] || ss[0].split(' ').slice(0, 5).join(' ')),
    one_line: () => ss[0],
    key_points: () => bullets(ss.slice(0, Math.min(max, lim))),
    why_how: () => ss.slice(0, { short: 1, medium: 3, detailed: 99 }[depth] ?? 3).join(' '),
    process: () => steps(ss.slice(0, lim)),
    terms: () => bullets(terms.slice(0, Math.min(lim, 5)).map((t) => `**${cap(t)}**: ${def(t)}`)),
    examples: () => { const e = ss.filter((s) => /such as|for example|e\.g\.|for instance/i.test(s)); return bullets(e.length ? e : ['The passage gives no worked example.']); },
    confusions: () => bullets(terms.slice(0, 2).map((t) => `Use “${t}” exactly as the text defines it, not loosely.`)),
    memory: () => bullets([`Hook the key words together: ${terms.slice(0, 4).join(' · ')}`]),
    exam_takeaway: () => `Remember: ${ss[0]}`,
    exam_relevance: () => (exam.startsWith('none') ? 'A core idea worth knowing for general understanding.' : `Expect ${exam} questions on “${terms[0] || 'this idea'}”.`),
  };
  return labels.filter((l) => make[ID_BY_LABEL.get(l)]).map((l) => `## ${l}\n${make[ID_BY_LABEL.get(l)]()}`).join('\n\n');
}

function practice(prompt, text) {
  const count = Number(grab(prompt, /Question count: (\d+)/, '5'));
  const ss = sentences(text);
  const terms = topTerms(text, 12);
  const questions = [];
  for (const term of terms) {
    if (questions.length >= count) break;
    const s = ss.find((x) => x.toLowerCase().includes(term));
    if (!s) continue;
    const blanked = s.replace(new RegExp(term, 'i'), '_____');
    const others = terms.filter((t) => t !== term).slice(0, 3);
    if (questions.length % 2 === 0 && others.length === 3) {
      const options = [...others]; const answerIndex = questions.length % 4; options.splice(answerIndex, 0, term);
      questions.push({ type: 'mcq', question: `Fill in the blank: ${blanked}`, options: options.map(cap), answerIndex, explanation: s });
    } else {
      questions.push({ type: 'short', question: `Fill in the blank: ${blanked}`, answer: cap(term), explanation: s });
    }
  }
  return JSON.stringify({ questions });
}

function chat(prompt) {
  const excerpt = (prompt.match(/EXCERPT\n<<<\n([\s\S]*?)\n>>>/) || [, ''])[1];
  const question = prompt.slice(prompt.lastIndexOf('\nSTUDENT QUESTION\n') + 18).toLowerCase();
  const words = new Set((question.match(/[a-z]{4,}/g) || []).filter((w) => !STOP.has(w)));
  const hits = sentences(excerpt)
    .map((s, i) => ({ s, i, score: [...words].filter((w) => s.toLowerCase().includes(w)).length }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 2).sort((a, b) => a.i - b.i);
  if (!hits.length) return 'This page doesn’t seem to cover that. (outside this page) Try selecting the sentence you’re unsure about.';
  return `From this page:\n\n${hits.map((h) => `- ${h.s}`).join('\n')}`;
}

export const demoProvider = {
  id: 'demo',
  label: 'Demo mode (no AI model)',
  async generate(prompt, { onText } = {}) {
    const text = prompt.slice(prompt.lastIndexOf('<<<\n') + 4, prompt.lastIndexOf('\n>>>'));
    if (/ACTION: chat/.test(prompt)) {
      const md = chat(prompt);
      if (onText) { onText(md.slice(0, Math.ceil(md.length / 2))); await new Promise((r) => setTimeout(r, 0)); }
      return md;
    }
    if (/ACTION: practice/.test(prompt)) return practice(prompt, text);
    const md = study(prompt, text);
    if (onText) { onText(md.slice(0, Math.ceil(md.length / 2))); await new Promise((r) => setTimeout(r, 0)); }
    return md;
  },
};
