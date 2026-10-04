import { normalizeEntries, parsePyqBank, searchPyqs } from './pyq.js';

// TEST FIXTURES ONLY: invented entries to exercise retrieval. They are not real exam questions.
const BANK = parsePyqBank(JSON.stringify([
  { id: 'f1', exam: 'NEET', year: 2001, question: 'Which cycle fixes carbon dioxide into sugar using ATP and NADPH in the stroma?', topic: 'Photosynthesis' },
  { id: 'f2', exam: 'JEE', year: 2002, question: 'The Calvin cycle reduces carbon dioxide using ATP and NADPH. Identify the product.', topic: 'Photosynthesis' },
  { id: 'f3', exam: 'JEE', year: 2003, question: 'Find the derivative of a polynomial function at x = 2.', topic: 'Calculus' },
  { exam: 'JEE', question: 'no year' },
  'junk',
])).entries;
const TEXT = 'The Calvin cycle uses ATP and NADPH to fix carbon dioxide into sugar.';

describe('parsePyqBank', () => {
  it('keeps valid entries and counts skipped ones', () => {
    const r = parsePyqBank(JSON.stringify([{ exam: 'JEE', year: 2000, question: 'Q?' }, { question: 'no exam' }]));
    expect(r.entries).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });
  it('throws friendly errors', () => {
    expect(() => parsePyqBank('{bad')).toThrow(/not valid JSON/);
    expect(() => parsePyqBank('{"a":1}')).toThrow(/list of questions/);
  });
});

describe('searchPyqs', () => {
  it('returns relevant questions only, verbatim from the bank', () => {
    const { matches } = searchPyqs(BANK, TEXT);
    expect(matches.map((m) => m.entry.id).sort()).toEqual(['f1', 'f2']);
    for (const m of matches) expect(BANK).toContain(m.entry);
    expect(matches[0].matched.length).toBeGreaterThan(1);
  });
  it('filters by target exam and counts other-exam matches', () => {
    const r = searchPyqs(BANK, TEXT, { exam: 'JEE' });
    expect(r.matches.map((m) => m.entry.id)).toEqual(['f2']);
    expect(r.otherExam).toBe(1);
  });
  it('returns nothing for unrelated text or an empty bank', () => {
    expect(searchPyqs(BANK, 'Mughal architecture of the sixteenth century').matches).toEqual([]);
    expect(searchPyqs([], TEXT).matches).toEqual([]);
  });
});

describe('normalizeEntries', () => {
  it('makes minimal stored entries safe to search', () => {
    const [e] = normalizeEntries([{ exam: 'JEE', year: '2002', question: 'Calvin cycle fixes carbon dioxide?' }]);
    expect(e).toMatchObject({ year: 2002, tags: [], options: [], answer: '' });
    expect(() => searchPyqs([e], 'Calvin cycle carbon dioxide')).not.toThrow();
  });
});
