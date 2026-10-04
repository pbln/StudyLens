import { cleanText, countWords, readSelection } from './selection.js';

describe('cleanText', () => {
  it('joins lines and hyphenated words', () => {
    expect(cleanText('photo-\nsynthesis is the\nprocess')).toBe('photosynthesis is the process');
  });
  it('collapses spaces', () => expect(cleanText('  a   b \u00a0 c ')).toBe('a b c'));
});

describe('readSelection', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div data-page="2"><span id="s">Calvin cycle fixes CO2</span></div>';
  });
  it('returns text and page number', () => {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('s'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    expect(readSelection()).toEqual({ text: 'Calvin cycle fixes CO2', page: 2 });
  });
  it('returns null when nothing is selected', () => {
    window.getSelection().removeAllRanges();
    expect(readSelection()).toBeNull();
  });
  it('counts words', () => expect(countWords('a b c')).toBe(3));
});
