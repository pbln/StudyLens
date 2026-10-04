import { useEffect, useRef, useState } from 'react';
import Markdown from './Markdown.jsx';

const SUGGESTIONS = ['Explain this page simply', 'What are the key terms on this page?', 'Give me an example'];

function Bubble({ m, isLast, onRetry }) {
  if (m.role === 'user') {
    return (
      <div className="msg user">
        {m.pinned && <blockquote>{m.pinned}</blockquote>}
        <p>{m.text}</p>
        <small>{m.page ? `Page ${m.page}` : ''}</small>
      </div>
    );
  }
  return (
    <div className="msg bot">
      {m.status === 'streaming' && !m.text && <p className="muted" role="status">Thinking…</p>}
      {m.text && <Markdown text={m.text} />}
      {m.status === 'streaming' && m.text && <span className="muted" role="status">Writing…</span>}
      {m.status === 'stopped' && <p className="muted">Stopped.</p>}
      {m.status === 'error' && (
        <>
          <p className="error-box" role="alert">{m.error}</p>
          {isLast && <button onClick={onRetry}>Try again</button>}
        </>
      )}
    </div>
  );
}

export default function ChatPanel({ hasPdf, page, profile, messages, busy, pinned, onUnpin, onSend, onStop, onRetry, onClear }) {
  const [text, setText] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }); }, [messages]);

  const submit = (q = text) => {
    const question = q.trim();
    if (!question || busy || !hasPdf) return;
    onSend(question);
    setText('');
  };

  return (
    <section className="chat" aria-label="Ask doubts">
      <div className="row">
        <h2>Ask a doubt</h2>
        {messages.length > 0 && <button className="link" onClick={onClear}>New chat</button>}
      </div>
      {!hasPdf && <p className="empty">Open a PDF to ask questions about the page you’re reading.</p>}
      {hasPdf && messages.length === 0 && (
        <div>
          <p className="empty">Ask anything about the page you’re on. Or select a sentence, right-click, and choose “Ask a doubt about this”.</p>
          <div className="chips">{SUGGESTIONS.map((s) => <button key={s} onClick={() => submit(s)}>{s}</button>)}</div>
        </div>
      )}
      <div className="msgs">
        {messages.map((m, i) => <Bubble key={m.id} m={m} isLast={i === messages.length - 1} onRetry={onRetry} />)}
        <div ref={end} />
      </div>
      <div className="composer">
        {pinned && (
          <div className="pinned">
            <span>“{pinned.text.length > 120 ? `${pinned.text.slice(0, 120)}…` : pinned.text}”</span>
            <button className="link" aria-label="Remove selected text" onClick={onUnpin}>×</button>
          </div>
        )}
        <textarea
          aria-label="Your doubt" rows={2} value={text} disabled={!hasPdf} placeholder="Type your doubt…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <div className="row">
          <span className="meta">{hasPdf ? `Uses page ${pinned?.page ?? page} · ${profile.name}` : ''}</span>
          {busy
            ? <button onClick={onStop}>Stop</button>
            : <button className="primary" disabled={!text.trim() || !hasPdf} onClick={() => submit()}>Send</button>}
        </div>
      </div>
    </section>
  );
}
