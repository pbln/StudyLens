import Markdown from '../Markdown.jsx';
import { sectionLabel } from '../../lib/profileSchema.js';

function Warning({ check }) {
  if (!check || check.ok) return null;
  const bits = [];
  if (check.missing.length) bits.push(`missing: ${check.missing.map(sectionLabel).join(', ')}`);
  if (check.extra.length) bits.push(`extra: ${check.extra.join(', ')}`);
  if (!check.inOrder) bits.push('sections are out of order');
  return <p className="muted warn" role="note">Gemma didn’t follow your structure exactly ({bits.join('; ')}). Run again for a cleaner result.</p>;
}

/** The notes are the model's own Markdown, shown as written. */
export default function StudyResult({ data }) {
  return (
    <div className="result" data-testid="study-result">
      <Markdown text={data.markdown} />
      <Warning check={data.meta?.check} />
      {data.meta?.truncated && <p className="muted">Only the first part of a very long selection was used.</p>}
    </div>
  );
}
