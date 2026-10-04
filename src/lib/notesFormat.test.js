import { makeProfile } from './profileSchema.js';
import { checkNotes, cleanNotes } from './notesFormat.js';

const profile = makeProfile({ name: 'T', enabled: ['key_points', 'process', 'confusions'] });

describe('checkNotes', () => {
  it('accepts exactly the right sections in order', () => {
    expect(checkNotes('## Key points\n- a\n## Process or flow\n1. x\n## Common confusions / mistakes\n- y', profile).ok).toBe(true);
  });
  it('tolerates heading level, bold and case', () => {
    expect(checkNotes('### **KEY POINTS**\n- a\n# process or flow\n1. x\n## Common confusions / mistakes\n- y', profile).ok).toBe(true);
  });
  it('reports missing, extra, duplicate and disabled-section headings', () => {
    const c = checkNotes('## Key points\n- a\n## Examples\n- e\n## Key points\n- again', profile);
    expect(c.missing).toEqual(['process', 'confusions']);
    expect(c.extra).toEqual(['Examples', 'Key points']);
    expect(c.ok).toBe(false);
  });
  it('reports order problems', () => {
    const c = checkNotes('## Process or flow\n1. x\n## Key points\n- a\n## Common confusions / mistakes\n- y', profile);
    expect(c.inOrder).toBe(false);
    expect(c.missing).toEqual([]);
  });
});

describe('cleanNotes', () => {
  it('leaves good notes untouched', () => expect(cleanNotes('## A\n- x')).toBe('## A\n- x'));
  it('keeps text that has no heading yet (mid-stream)', () => expect(cleanNotes('## Key po')).toBe('## Key po'));
});
