import { examLabel } from './profileSchema.js';
import { buildPracticePrompt, buildRepairPrompt, buildStudyPrompt } from './promptBuilder.js';
import { extractJson, ParseError, validatePractice } from './parseResponse.js';
import { checkNotes, cleanNotes } from './notesFormat.js';
import { searchPyqs } from './pyq.js';

export class PipelineError extends Error {}

/** Ask once; if the reply is unreadable or fails validation, ask once more with the problems spelled out. */
async function generateValidated({ prompt, provider, signal, parse }) {
  const attempt = async (p) => {
    const raw = await provider.generate(p, { signal, json: true });
    try { return { raw, result: parse(raw) }; } catch (e) {
      if (e instanceof ParseError) return { raw, error: e.message };
      throw e;
    }
  };
  const first = await attempt(prompt);
  const issues = (a) => (a.error ? [a.error] : a.result.problems);
  if (!issues(first).length) return { ...first.result, attempts: 1 };

  const second = await attempt(buildRepairPrompt(prompt, first.raw, issues(first)));
  if (second.result) return { ...second.result, attempts: 2 };
  throw new PipelineError('The model’s reply could not be read as structured notes. Try again, or pick a different model in Settings.');
}

const baseMeta = (profile, provider, extra) => ({
  profileId: profile.id, profileName: profile.name, exam: examLabel(profile), depth: profile.depth,
  language: profile.language, model: provider?.label ?? '', ...extra,
});

export async function runAction({ action, text, profile, provider, pyqBank = [], signal, options = {}, onPartial }) {
  if (!text?.trim()) throw new PipelineError('Select some text first.');

  if (action === 'study') {
    // One call, no retry: the model writes the notes in their final format and they are shown as written.
    const { prompt, truncated } = buildStudyPrompt(text, profile);
    const raw = await provider.generate(prompt, {
      signal, ...(onPartial ? { onText: (t) => onPartial({ markdown: cleanNotes(t) }) } : {}),
    });
    const markdown = cleanNotes(raw);
    if (!markdown) throw new PipelineError('The model returned no notes. Try again.');
    return { action, markdown, meta: baseMeta(profile, provider, { attempts: 1, check: checkNotes(markdown, profile), truncated }) };
  }

  if (action === 'practice') {
    const { prompt, truncated } = buildPracticePrompt(text, profile, options);
    const r = await generateValidated({ prompt, provider, signal, parse: (raw) => validatePractice(extractJson(raw)) });
    return { action, questions: r.questions, meta: baseMeta(profile, provider, { attempts: r.attempts, truncated }) };
  }

  if (action === 'pyq') {
    // Retrieval only: the model is never asked to produce or recall exam questions.
    const { matches, otherExam } = searchPyqs(pyqBank, text, { exam: examLabel(profile) });
    return { action, matches, meta: baseMeta(profile, null, { bankSize: pyqBank.length, otherExam }) };
  }

  throw new PipelineError(`Unknown action: ${action}`);
}