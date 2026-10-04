import { SECTIONS, enabledSections } from './profileSchema.js';

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const BY_LABEL = new Map(SECTIONS.map((s) => [norm(s.label), s.id]));
const HEADING = /^\s{0,3}#{1,4}\s+(.+?)\s*#*\s*$/gm;

/** Only guards against stray wrapping: a code fence, or chatter before the first heading. Nothing is rewritten. */
export function cleanNotes(raw) {
  let s = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  s = s.replace(/^```[a-z]*\n/i, '').replace(/\n```\s*$/, '');
  const i = s.search(/^\s{0,3}#{1,4}\s/m);
  return (i > 0 ? s.slice(i) : s).trim();
}

/** Read-only check of the model's notes against the profile. Used to warn, never to change the notes. */
export function checkNotes(markdown, profile) {
  const expected = enabledSections(profile);
  const found = [];
  const extra = [];
  for (const m of markdown.matchAll(HEADING)) {
    const label = norm(m[1].replace(/\*\*/g, ''));
    const id = BY_LABEL.get(label);
    if (id && expected.includes(id) && !found.includes(id)) found.push(id); else extra.push(m[1].replace(/\*\*/g, '').trim());
  }
  const missing = expected.filter((id) => !found.includes(id));
  const inOrder = found.join() === expected.filter((id) => found.includes(id)).join();
  return { expected, found, missing, extra, inOrder, ok: !missing.length && !extra.length && inOrder };
}
