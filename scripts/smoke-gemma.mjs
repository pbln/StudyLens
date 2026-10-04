#!/usr/bin/env node
// Live check against a real Gemma endpoint. Runs the real prompt builder and pipeline for every preset
// plus a custom "Key points -> Process -> Confusions" structure, and verifies the returned structure.
//   Ollama:  node scripts/smoke-gemma.mjs --provider ollama --model gemma4:e4b
//   Google:  GEMINI_API_KEY=... node scripts/smoke-gemma.mjs --provider google --model gemma-4-31b-it
import { BUILT_INS, makeProfile, enabledSections } from '../src/lib/profileSchema.js';
import { createProvider, MODEL_DEFAULTS } from '../src/lib/gemma/index.js';
import { runAction } from '../src/lib/pipeline.js';
import { checkNotes } from '../src/lib/notesFormat.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const provider = arg('provider', 'ollama');
const settings = {
  ...MODEL_DEFAULTS, provider,
  ollamaUrl: arg('url', MODEL_DEFAULTS.ollamaUrl),
  ollamaModel: arg('model', MODEL_DEFAULTS.ollamaModel),
  googleModel: arg('model', MODEL_DEFAULTS.googleModel),
  googleKey: process.env.GEMINI_API_KEY ?? '',
};
const model = createProvider(settings);

const TEXT = 'The light reactions of photosynthesis occur in the thylakoid membranes of the chloroplast. Water is split, oxygen is released, and ATP and NADPH are produced. The Calvin cycle then uses this ATP and NADPH to fix carbon dioxide into sugar in the stroma.';
const custom = makeProfile({ name: 'Key points -> Process -> Confusions', enabled: ['key_points', 'process', 'confusions'], maxKeyPoints: 3 });

let failed = 0;
for (const profile of [...BUILT_INS, custom]) {
  const want = enabledSections(profile);
  try {
    const t0 = Date.now();
    let firstAt = null;
    const r = await runAction({ action: 'study', text: TEXT, profile, provider: model, onPartial: () => { firstAt ??= Date.now() - t0; } });
    const c = checkNotes(r.markdown, profile);
    if (!c.ok) failed++;
    console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${profile.name}  (first text ${firstAt ?? '?'}ms, total ${Date.now() - t0}ms)\n      wanted ${want.join(' > ')}\n      got    ${c.found.join(' > ')}${c.missing.length ? `  missing: ${c.missing}` : ''}${c.extra.length ? `  extra: ${c.extra}` : ''}${c.inOrder ? '' : '  OUT OF ORDER'}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${profile.name}: ${e.message}`);
  }
}
try {
  const r = await runAction({ action: 'practice', text: TEXT, profile: BUILT_INS[2], provider: model });
  console.log(`PASS  practice questions: ${r.questions.length}`);
} catch (e) { failed++; console.log(`FAIL  practice: ${e.message}`); }

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed. Read a few outputs yourself to judge quality.');
process.exit(failed ? 1 : 0);
