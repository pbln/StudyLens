import {
  depthLabel, enabledSections, examLabel, languageLabel, sectionLabel,
} from '../lib/profileSchema.js';

/** Shows what the active profile will produce: sections in order, plus the settings that shape them. */
export default function StructurePreview({ profile }) {
  const ids = enabledSections(profile);
  const facts = [
    examLabel(profile) !== 'None' && examLabel(profile),
    `${depthLabel(profile)} depth`,
    languageLabel(profile),
    ids.includes('key_points') && `up to ${profile.maxKeyPoints} key points`,
  ].filter(Boolean);
  return (
    <div className="structure" data-testid="structure-preview">
      <p className="meta">Notes for this text will contain:</p>
      <ol>{ids.map((id) => <li key={id}>{sectionLabel(id)}</li>)}</ol>
      <p className="meta">{facts.join(' · ')}</p>
    </div>
  );
}
