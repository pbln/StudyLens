// Study Profile = plain, JSON-serialisable configuration. Stage 3's prompt builder reads this directly.
export const SCHEMA_VERSION = 1;

export const SECTIONS = [
  { id: 'topic', label: 'Topic / concept', hint: 'Names what the passage is about' },
  { id: 'one_line', label: 'One-line explanation', hint: 'The idea in a single sentence' },
  { id: 'key_points', label: 'Key points', hint: 'Short bullets, capped by your maximum' },
  { id: 'why_how', label: 'Why / how explanation', hint: 'The reasoning behind it' },
  { id: 'process', label: 'Process or flow', hint: 'Steps in order, where there are steps' },
  { id: 'terms', label: 'Important terms', hint: 'Definitions of the terms to know' },
  { id: 'examples', label: 'Examples', hint: 'Worked or real-world examples' },
  { id: 'confusions', label: 'Common confusions / mistakes', hint: 'Where students usually slip' },
  { id: 'memory', label: 'Memory tricks', hint: 'Mnemonics and hooks' },
  { id: 'exam_takeaway', label: 'Exam takeaway', hint: 'What to remember for the paper' },
  { id: 'exam_relevance', label: 'Exam relevance', hint: 'How likely and how it is asked' },
];
export const SECTION_IDS = SECTIONS.map((s) => s.id);
export const sectionLabel = (id) => SECTIONS.find((s) => s.id === id)?.label ?? id;

export const EXAMS = ['None', 'JEE', 'NEET', 'UPSC', 'GATE', 'Custom'];
export const DEPTHS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'detailed', label: 'Detailed' },
];
export const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'simple_english', label: 'Simple English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'hinglish', label: 'Hinglish' },
];
export const KEY_POINTS_RANGE = { min: 1, max: 15 };
const DEFAULT_KEY_POINTS = 6;

export function newId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Enabled ids first (in the given order), then every remaining section switched off. */
function orderSections(enabledIds) {
  const rest = SECTION_IDS.filter((id) => !enabledIds.includes(id));
  return [...enabledIds, ...rest].map((id) => ({ id, enabled: enabledIds.includes(id) }));
}

export function makeProfile({
  id = newId(), name, enabled, exam = 'None', customExam = '',
  depth = 'medium', language = 'english', maxKeyPoints = DEFAULT_KEY_POINTS, builtIn = false,
}) {
  return {
    version: SCHEMA_VERSION, id, name, builtIn,
    targetExam: { type: exam, custom: customExam },
    depth, language, maxKeyPoints,
    sections: orderSections(enabled),
  };
}

export const BUILT_INS = [
  makeProfile({
    id: 'preset-quick', name: 'Quick Revision', builtIn: true, depth: 'short', language: 'simple_english', maxKeyPoints: 5,
    enabled: ['topic', 'one_line', 'key_points', 'terms', 'exam_takeaway'],
  }),
  makeProfile({
    id: 'preset-understand', name: 'Understand', builtIn: true, depth: 'detailed', maxKeyPoints: 6,
    enabled: ['topic', 'one_line', 'why_how', 'process', 'examples', 'confusions', 'key_points'],
  }),
  makeProfile({
    id: 'preset-exam', name: 'Competitive Exam', builtIn: true, exam: 'JEE', depth: 'medium', maxKeyPoints: 8,
    enabled: ['topic', 'key_points', 'terms', 'confusions', 'memory', 'exam_takeaway', 'exam_relevance'],
  }),
];

/** Repairs anything loaded from storage: unknown sections dropped, missing ones added (off), bad values reset. */
export function normalizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const seen = new Set();
  const sections = [];
  for (const s of Array.isArray(raw.sections) ? raw.sections : []) {
    if (s && SECTION_IDS.includes(s.id) && !seen.has(s.id)) {
      seen.add(s.id);
      sections.push({ id: s.id, enabled: s.enabled === true });
    }
  }
  for (const id of SECTION_IDS) if (!seen.has(id)) sections.push({ id, enabled: false });

  const type = EXAMS.includes(raw.targetExam?.type) ? raw.targetExam.type : 'None';
  const custom = type === 'Custom' && typeof raw.targetExam?.custom === 'string' ? raw.targetExam.custom.trim().slice(0, 60) : '';
  const n = Math.round(Number(raw.maxKeyPoints));
  const maxKeyPoints = Number.isFinite(n)
    ? Math.min(KEY_POINTS_RANGE.max, Math.max(KEY_POINTS_RANGE.min, n)) : DEFAULT_KEY_POINTS;

  return {
    version: SCHEMA_VERSION,
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    name: (typeof raw.name === 'string' && raw.name.trim().slice(0, 60)) || 'Untitled structure',
    builtIn: false,
    targetExam: { type, custom },
    depth: DEPTHS.some((d) => d.value === raw.depth) ? raw.depth : 'medium',
    language: LANGUAGES.some((l) => l.value === raw.language) ? raw.language : 'english',
    maxKeyPoints,
    sections,
  };
}

/** Returns a list of problems that block saving. */
export function validateProfile(p) {
  const errors = [];
  if (!p.name.trim()) errors.push('Give this structure a name.');
  if (!p.sections.some((s) => s.enabled)) errors.push('Turn on at least one section.');
  if (p.targetExam.type === 'Custom' && !p.targetExam.custom.trim()) errors.push('Enter the name of your exam.');
  const n = Number(p.maxKeyPoints);
  if (!Number.isInteger(n) || n < KEY_POINTS_RANGE.min || n > KEY_POINTS_RANGE.max) {
    errors.push(`Key points must be between ${KEY_POINTS_RANGE.min} and ${KEY_POINTS_RANGE.max}.`);
  }
  return errors;
}

export const enabledSections = (p) => p.sections.filter((s) => s.enabled).map((s) => s.id);
export const examLabel = (p) => (p.targetExam.type === 'Custom' ? p.targetExam.custom : p.targetExam.type);
export const depthLabel = (p) => DEPTHS.find((d) => d.value === p.depth)?.label ?? p.depth;
export const languageLabel = (p) => LANGUAGES.find((l) => l.value === p.language)?.label ?? p.language;
