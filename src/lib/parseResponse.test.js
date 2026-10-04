import { ParseError, extractJson, validatePractice } from './parseResponse.js';

describe('extractJson', () => {
  it('reads plain, fenced, and prose-wrapped JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here you go:\n{"a":{"b":"}"}} hope that helps')).toEqual({ a: { b: '}' } });
  });
  it('throws ParseError for empty, missing, cut-off or malformed replies', () => {
    for (const bad of ['', 'no json here', '{"a": [1, 2', '{"a": nope} trailing']) {
      expect(() => extractJson(bad)).toThrow(ParseError);
    }
  });
});

describe('validatePractice', () => {
  it('keeps valid questions and drops broken ones', () => {
    const r = validatePractice({ questions: [
      { type: 'mcq', question: 'Q1', options: ['a', 'b', 'c', 'd'], answerIndex: 2, explanation: 'e' },
      { type: 'mcq', question: 'Q2', options: ['a', 'b'], answerIndex: 9 },
      { type: 'short', question: 'Q3', answer: 'x' },
      { type: 'short', question: 'Q4' },
    ] });
    expect(r.questions.map((q) => q.question)).toEqual(['Q1', 'Q3']);
    expect(r.problems).toEqual([]);
  });
  it('reports a problem when nothing is usable', () => {
    expect(validatePractice({ questions: [{ question: '' }] }).problems.length).toBeGreaterThan(0);
  });
});
