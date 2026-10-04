import { makeProfile } from './profileSchema.js';
import { partialSections } from './parseResponse.js';
import { runAction } from './pipeline.js';

const profile = makeProfile({ name: 'T', enabled: ['topic', 'key_points'], maxKeyPoints: 3 });

describe('partialSections', () => {
  it('returns only the sections that are already complete', () => {
    const raw = '{"sections":[{"id":"topic","content":"Archaebacteria"},{"id":"key_points","content":["a","b"';
    expect(partialSections(raw, profile).map((s) => s.id)).toEqual(['topic']);
  });
  it('handles braces inside strings and returns nothing before the list starts', () => {
    expect(partialSections('{"sections":[{"id":"topic","content":"a } b"},', profile)[0].content).toBe('a } b');
    expect(partialSections('{"sec', profile)).toEqual([]);
  });
});

describe('streaming study notes', () => {
  it('streams partial study notes to onPartial', async () => {
    const provider = { generate: async (_p, { onText }) => { const full = '{"sections":[{"id":"topic","content":"T"},{"id":"key_points","content":["x"]}]}'; onText?.(full.slice(0, 41)); return full; } };
    const seen = [];
    await runAction({ action: 'study', text: 'abc', profile, provider, onPartial: (p) => seen.push(p.sections.map((s) => s.id)) });
    expect(seen).toEqual([['topic']]);
  });
});
