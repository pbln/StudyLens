// Pure, immutable edits on a profile.
export function moveSectionTo(profile, from, to) {
  const n = profile.sections.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return profile;
  const sections = [...profile.sections];
  const [item] = sections.splice(from, 1);
  sections.splice(to, 0, item);
  return { ...profile, sections };
}

export function moveSection(profile, id, delta) {
  const i = profile.sections.findIndex((s) => s.id === id);
  return moveSectionTo(profile, i, i + delta);
}

export function toggleSection(profile, id) {
  return {
    ...profile,
    sections: profile.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
  };
}
