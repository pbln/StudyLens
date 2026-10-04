import {
  BUILT_INS, SECTION_IDS, enabledSections, normalizeProfile, validateProfile,
} from './profileSchema.js';
import { moveSection, moveSectionTo, toggleSection } from './profileOps.js';

describe('built-in presets', () => {
  it('are valid, cover every section, and differ from each other', () => {
    for (const p of BUILT_INS) {
      expect(validateProfile(p)).toEqual([]);
      expect(p.sections.map((s) => s.id).sort()).toEqual([...SECTION_IDS].sort());
    }
    const orders = BUILT_INS.map((p) => enabledSections(p).join());
    expect(new Set(orders).size).toBe(3);
  });
  it('survive a JSON round trip unchanged', () => {
    for (const p of BUILT_INS) expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
});

describe('normalizeProfile', () => {
  it('repairs corrupt data', () => {
    const p = normalizeProfile({
      id: 'x', name: '  ', depth: 'huge', language: 'klingon', maxKeyPoints: 99,
      targetExam: { type: 'Nope', custom: 'a' },
      sections: [{ id: 'memory', enabled: true }, { id: 'memory', enabled: true }, { id: 'bogus', enabled: true }],
    });
    expect(p.name).toBe('Untitled structure');
    expect(p.depth).toBe('medium');
    expect(p.language).toBe('english');
    expect(p.maxKeyPoints).toBe(15);
    expect(p.targetExam).toEqual({ type: 'None', custom: '' });
    expect(p.sections).toHaveLength(SECTION_IDS.length);
    expect(p.sections[0]).toEqual({ id: 'memory', enabled: true });
    expect(p.sections.slice(1).every((s) => !s.enabled)).toBe(true);
  });
  it('rejects non-objects', () => {
    expect(normalizeProfile(null)).toBeNull();
    expect(normalizeProfile('x')).toBeNull();
  });
});

describe('validateProfile', () => {
  const base = BUILT_INS[0];
  it('flags no sections, empty name, empty custom exam, bad key-point count', () => {
    const none = { ...base, sections: base.sections.map((s) => ({ ...s, enabled: false })) };
    expect(validateProfile(none)).toContain('Turn on at least one section.');
    expect(validateProfile({ ...base, name: ' ' })).toContain('Give this structure a name.');
    expect(validateProfile({ ...base, targetExam: { type: 'Custom', custom: '' } })).toContain('Enter the name of your exam.');
    expect(validateProfile({ ...base, maxKeyPoints: 0 })).toHaveLength(1);
    expect(validateProfile({ ...base, maxKeyPoints: '' })).toHaveLength(1);
  });
});

describe('reordering', () => {
  const p = BUILT_INS[0];
  it('moves a section up and down without mutating', () => {
    const before = JSON.stringify(p);
    const up = moveSection(p, 'key_points', -1);
    expect(up.sections[1].id).toBe('key_points');
    expect(moveSection(up, 'key_points', 1)).toEqual(p);
    expect(JSON.stringify(p)).toBe(before);
  });
  it('ignores moves past the ends', () => {
    expect(moveSection(p, p.sections[0].id, -1)).toBe(p);
    expect(moveSectionTo(p, 0, 99)).toBe(p);
  });
  it('moves by drag index and toggles', () => {
    expect(moveSectionTo(p, 0, 2).sections[2].id).toBe(p.sections[0].id);
    expect(enabledSections(toggleSection(p, 'examples'))).toContain('examples');
  });
});
