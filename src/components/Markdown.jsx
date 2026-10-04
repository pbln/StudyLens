// Renders the small Markdown subset the study prompt asks for. Builds React elements (no raw HTML), so
// anything the model writes is shown as text. Works on half-finished text, so it can render while streaming.
const BULLET = /^\s*(?:[-*•])\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const HEAD = /^\s{0,3}#{1,4}\s+(.*?)\s*#*\s*$/;

function inline(s) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (
    part.length > 4 && part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  ));
}

export function parseBlocks(text) {
  const blocks = [];
  let list = null;
  for (const line of text.split('\n')) {
    let m;
    if ((m = line.match(HEAD))) { list = null; blocks.push({ t: 'h', text: m[1].replace(/\*\*/g, '') }); } else if ((m = line.match(BULLET))) {
      if (list?.t !== 'ul') { list = { t: 'ul', items: [] }; blocks.push(list); }
      list.items.push(m[1]);
    } else if ((m = line.match(NUMBER))) {
      if (list?.t !== 'ol') { list = { t: 'ol', items: [] }; blocks.push(list); }
      list.items.push(m[1]);
    } else if (line.trim()) { list = null; blocks.push({ t: 'p', text: line.trim() }); } else list = null;
  }
  return blocks;
}

export default function Markdown({ text }) {
  const sections = [];
  for (const b of parseBlocks(text)) {
    if (b.t === 'h' || !sections.length) sections.push({ title: b.t === 'h' ? b.text : null, body: [] });
    if (b.t !== 'h') sections[sections.length - 1].body.push(b);
  }
  return (
    <>
      {sections.map((sec, i) => (
        <section key={i} className="note-sec">
          {sec.title && <h4>{sec.title}</h4>}
          {sec.body.map((b, j) => {
            if (b.t === 'ul') return <ul key={j}>{b.items.map((x, k) => <li key={k}>{inline(x)}</li>)}</ul>;
            if (b.t === 'ol') return <ol key={j}>{b.items.map((x, k) => <li key={k}>{inline(x)}</li>)}</ol>;
            return <p key={j}>{inline(b.text)}</p>;
          })}
        </section>
      ))}
    </>
  );
}
