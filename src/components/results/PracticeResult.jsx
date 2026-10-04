import { useState } from 'react';

function Question({ q, n }) {
  const [shown, setShown] = useState(false);
  return (
    <li className="q">
      <p className="qtext">{q.question}</p>
      {q.type === 'mcq' && (
        <ol type="A" className="opts">
          {q.options.map((o, i) => <li key={i} className={shown && i === q.answerIndex ? 'right' : ''}>{o}</li>)}
        </ol>
      )}
      <button className="link" aria-label={`${shown ? 'Hide' : 'Show'} answer ${n}`} onClick={() => setShown((s) => !s)}>
        {shown ? 'Hide answer' : 'Show answer'}
      </button>
      {shown && (
        <p className="ans">
          <strong>{q.type === 'mcq' ? `Answer: ${String.fromCharCode(65 + q.answerIndex)}` : `Answer: ${q.answer}`}</strong>
          {q.explanation && <><br />{q.explanation}</>}
        </p>
      )}
    </li>
  );
}

export default function PracticeResult({ data }) {
  return (
    <div className="result" data-testid="practice-result">
      <p className="badge ai">AI-generated practice questions, not actual exam questions</p>
      <ol className="qs">{data.questions.map((q, i) => <Question key={i} q={q} n={i + 1} />)}</ol>
    </div>
  );
}
