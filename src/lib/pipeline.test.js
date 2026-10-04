import { BUILT_INS, makeProfile } from './profileSchema.js';
import { parsePyqBank } from './pyq.js';
import { PipelineError, runAction } from './pipeline.js';

const TEXT = 'The Calvin cycle uses ATP and NADPH to fix carbon dioxide into sugar.';
const profile = makeProfile({ name: 'T', enabled: ['key_points', 'process'], maxKeyPoints: 3 });
const scripted = (...replies) => {
  const calls = [];
  return { label: 'fake', calls, generate: async (prompt) => { calls.push(prompt); const r = replies[Math.min(calls.length - 1, replies.length - 1)]; if (r instanceof Error) throw r; return r; } };
};
const good = '## Key points\n- k\n\n## Process or flow\n1. a\n2. b';

describe('runAction: study (direct Markdown)', () => {
  it('returns the model\'s Markdown as written, in one call', async () => {
    const provider = scripted(good);
    const r = await runAction({ action: 'study', text: TEXT, profile, provider });
    expect(r.markdown).toBe(good);
    expect(r.meta).toMatchObject({ attempts: 1, profileName: 'T' });
    expect(r.meta.check.ok).toBe(true);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toContain(TEXT);
  });
  it('never retries: a reply that ignores the structure is shown with a failed check', async () => {
    const provider = scripted('## Process or flow\n1. a\n\n## Fun facts\n- x');
    const r = await runAction({ action: 'study', text: TEXT, profile, provider });
    expect(provider.calls).toHaveLength(1);
    expect(r.meta.check).toMatchObject({ ok: false, missing: ['key_points'], extra: ['Fun facts'] });
  });
  it('strips only a code fence and chatter before the first heading', async () => {
    const r = await runAction({ action: 'study', text: TEXT, profile, provider: scripted(`Sure! Here you go:\n\`\`\`markdown\n${good}\n\`\`\``) });
    expect(r.markdown).toBe(good);
  });
  it('streams cleaned partial Markdown to onPartial', async () => {
    const provider = { label: 'f', generate: async (_p, { onText }) => { onText('## Key po'); onText('## Key points\n- k'); return good; } };
    const seen = [];
    await runAction({ action: 'study', text: TEXT, profile, provider, onPartial: (p) => seen.push(p.markdown) });
    expect(seen).toEqual(['## Key po', '## Key points\n- k']);
  });
  it('errors clearly on an empty reply and passes provider errors through', async () => {
    await expect(runAction({ action: 'study', text: TEXT, profile, provider: scripted('  ') })).rejects.toThrow(PipelineError);
    await expect(runAction({ action: 'study', text: TEXT, profile, provider: scripted(new Error('boom')) })).rejects.toThrow('boom');
  });
  it('rejects empty text', async () => {
    await expect(runAction({ action: 'study', text: '  ', profile, provider: scripted(good) })).rejects.toThrow(/Select some text/);
  });
});

describe('runAction: practice', () => {
  it('validates generated questions', async () => {
    const reply = JSON.stringify({ questions: [{ type: 'short', question: 'Q', answer: 'A' }] });
    const r = await runAction({ action: 'practice', text: TEXT, profile: BUILT_INS[0], provider: scripted(reply) });
    expect(r.questions).toHaveLength(1);
  });
});

describe('runAction: pyq', () => {
  it('never calls the model', async () => {
    const provider = scripted('x');
    const bank = parsePyqBank(JSON.stringify([{ id: 'f', exam: 'JEE', year: 2002, question: 'Calvin cycle fixes carbon dioxide using ATP and NADPH?' }])).entries;
    const r = await runAction({ action: 'pyq', text: TEXT, profile: BUILT_INS[0], provider, pyqBank: bank });
    expect(provider.calls).toHaveLength(0);
    expect(r.matches).toHaveLength(1);
    expect(r.meta.bankSize).toBe(1);
  });
});
