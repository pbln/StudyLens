import StudyResult from './StudyResult.jsx';
import PracticeResult from './PracticeResult.jsx';
import PyqResult from './PyqResult.jsx';

const COPY = {
  study: { run: 'Study this text', busy: 'Building your notes…', again: 'Run again with current structure' },
  pyq: { run: 'Find actual PYQs', busy: 'Searching your PYQ bank…', again: 'Search again' },
  practice: { run: 'Generate practice questions', busy: 'Writing practice questions…', again: 'Generate new questions' },
};

export default function RunView({ action, run, onRun, onCancel }) {
  const c = COPY[action];
  if (!run) return <button className="primary" onClick={onRun}>{c.run}</button>;
  if (run.status === 'loading') {
    // Study notes stream in: show the sections that are already finished while the rest is written.
    const partial = action === 'study' && run.partial?.markdown ? run.partial.markdown : null;
    return (
      <div>
        {partial && <StudyResult data={{ markdown: partial, meta: {} }} />}
        <div className="loading" role="status">
          <span>{partial ? 'Writing…' : c.busy}</span>
          <button className="link" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }
  if (run.status === 'error') {
    return (
      <div>
        <p className="error-box" role="alert">{run.error}</p>
        <button onClick={onRun}>Try again</button>
      </div>
    );
  }
  const { data } = run;
  return (
    <div>
      {action === 'study' && <StudyResult data={data} />}
      {action === 'practice' && <PracticeResult data={data} />}
      {action === 'pyq' && <PyqResult data={data} />}
      <p className="meta foot">
        {action === 'pyq' ? 'Retrieved from your bank' : `${data.meta.profileName} · ${data.meta.model}`}
        {data.meta.attempts > 1 ? ' · needed a retry' : ''}
      </p>
      <button onClick={onRun}>{c.again}</button>
    </div>
  );
}
