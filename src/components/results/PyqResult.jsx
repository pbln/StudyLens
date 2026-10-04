import { useState } from 'react';

function Pyq({ m, n }) {
  const [shown, setShown] = useState(false);
  const { entry: e } = m;
  return (
    <li className="q">
      <p className="meta"><strong>{e.exam} {e.year}</strong>{e.paper ? ` · ${e.paper}` : ''}{e.subject ? ` · ${e.subject}` : ''}</p>
      <p className="qtext">{e.question}</p>
      {e.options.length > 0 && <ol type="A" className="opts">{e.options.map((o, i) => <li key={i}>{o}</li>)}</ol>}
      <p className="meta">Matched: {m.matched.join(', ')}{e.source ? ` · Source: ${e.source}` : ''}</p>
      {e.answer && (
        <>
          <button className="link" aria-label={`${shown ? 'Hide' : 'Show'} PYQ answer ${n}`} onClick={() => setShown((s) => !s)}>
            {shown ? 'Hide answer' : 'Show answer'}
          </button>
          {shown && <p className="ans"><strong>Answer: {e.answer}</strong></p>}
        </>
      )}
    </li>
  );
}

export default function PyqResult({ data }) {
  const { bankSize, otherExam, exam } = data.meta;
  if (bankSize === 0) {
    return (
      <div className="result" data-testid="pyq-result">
        <p className="badge real">Actual previous-year questions</p>
        <p className="muted">No PYQ bank is loaded yet. Import your question file in Settings and StudyLens will search it. It never makes questions up.</p>
      </div>
    );
  }
  return (
    <div className="result" data-testid="pyq-result">
      <p className="badge real">Actual previous-year questions, from your bank of {bankSize}</p>
      {data.matches.length === 0 ? (
        <p className="muted">
          No questions in your bank match this text{exam !== 'None' ? ` for ${exam}` : ''}.
          {otherExam > 0 ? ` ${otherExam} matched in other exams. Switch the study structure’s target exam to “None” to see them.` : ''}
        </p>
      ) : (
        <ol className="qs">{data.matches.map((m, i) => <Pyq key={m.entry.id} m={m} n={i + 1} />)}</ol>
      )}
    </div>
  );
}
