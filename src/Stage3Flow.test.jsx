import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import App from './App.jsx';
import { demoProvider } from './lib/gemma/demoProvider.js';
import { ProviderError } from './lib/gemma/providers.js';
import { makeProfile } from './lib/profileSchema.js';

vi.mock('./lib/pdf.js', () => ({ loadPdf: vi.fn(async () => ({ numPages: 1 })), pdfjs: {} }));
vi.mock('./components/PdfViewer.jsx', () => ({
  default: () => <div data-page="1"><span data-testid="t1">{globalThis.__TEXT}</span></div>,
}));

globalThis.__TEXT = 'The light reactions occur in the thylakoid membranes. Water is split and oxygen is released. ATP and NADPH are produced. For example, chlorophyll absorbs red light.';

let prompts;
const recording = { ...demoProvider, generate: async (p, o) => { prompts.push(p); return demoProvider.generate(p, o); } };

const store = (custom, activeId) => localStorage.setItem('studylens.profiles.v1', JSON.stringify({ version: 1, custom, activeId }));
// The study result appears as soon as the first streamed text arrives, so wait for the run to finish.
const studyDone = async () => {
  await screen.findByTestId('study-result');
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
};
const headings = () => within(screen.getByTestId('study-result')).getAllByRole('heading', { level: 4 }).map((h) => h.textContent);

async function selectAndChoose(label, factory = () => recording) {
  render(<App providerFactory={factory} />);
  fireEvent.click(screen.getByText('Open sample'));
  const span = await screen.findByTestId('t1');
  const range = document.createRange();
  range.selectNodeContents(span);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  fireEvent.contextMenu(span);
  fireEvent.click(within(screen.getByRole('menu')).getByText(label));
}

beforeEach(() => { localStorage.clear(); prompts = []; });

describe('Stage 3: select -> right-click -> action -> prompt -> model -> rendered result', () => {
  it('offers the three StudyLens actions', async () => {
    render(<App providerFactory={() => recording} />);
    fireEvent.click(screen.getByText('Open sample'));
    const span = await screen.findByTestId('t1');
    const range = document.createRange(); range.selectNodeContents(span);
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
    fireEvent.contextMenu(span);
    const menu = within(screen.getByRole('menu'));
    for (const l of ['Explain / Study this', 'Find actual PYQs', 'Generate practice questions', 'Copy text']) expect(menu.getByText(l)).toBeInTheDocument();
  });

  it('Study: builds the prompt from the active profile and renders sections in that order', async () => {
    await selectAndChoose('Explain / Study this');
    await studyDone();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain(globalThis.__TEXT);
    expect([...prompts[0].matchAll(/^## (.+)$/gm)].map((m) => m[1])).toEqual(['Topic / concept', 'One-line explanation', 'Key points', 'Important terms', 'Exam takeaway']);
    expect(headings()).toEqual(['Topic / concept', 'One-line explanation', 'Key points', 'Important terms', 'Exam takeaway']);
    expect(within(screen.getByTestId('study-result')).getAllByText(/thylakoid/i).length).toBeGreaterThan(0);
  });

  it('same text, different Study Profile: structure changes, meaning is kept', async () => {
    await selectAndChoose('Explain / Study this');
    await studyDone();
    const first = headings();
    const firstText = screen.getByTestId('study-result').textContent;

    fireEvent.change(screen.getByLabelText('Study structure'), { target: { value: 'preset-exam' } });
    fireEvent.click(screen.getByText('Run again with current structure'));
    await screen.findByText(/Competitive Exam ·/);

    const second = headings();
    expect(second).toEqual([
      'Topic / concept', 'Key points', 'Important terms', 'Common confusions / mistakes',
      'Memory tricks', 'Exam takeaway', 'Exam relevance',
    ]);
    expect(second).not.toEqual(first);
    expect(prompts[1]).toContain('- Exam: JEE');
    expect(prompts[1]).toContain(globalThis.__TEXT);
    expect(screen.getByText(/JEE questions/)).toBeInTheDocument();
    for (const t of [firstText, screen.getByTestId('study-result').textContent]) expect(t.toLowerCase()).toContain('thylakoid');
  });

  it('a custom Key points -> Process -> Confusions structure returns only those, in that order', async () => {
    const p = makeProfile({ id: 'c1', name: 'Trap flow', enabled: ['key_points', 'process', 'confusions'], maxKeyPoints: 2 });
    store([p], 'c1');
    await selectAndChoose('Explain / Study this');
    await studyDone();
    expect(headings()).toEqual(['Key points', 'Process or flow', 'Common confusions / mistakes']);
    expect(screen.getByTestId('study-result').querySelector('ul').children).toHaveLength(2);
  });

  it('depth setting changes how much is returned', async () => {
    const short = makeProfile({ id: 's', name: 'S', enabled: ['why_how'], depth: 'short' });
    const long = makeProfile({ id: 'l', name: 'L', enabled: ['why_how'], depth: 'detailed' });
    store([short, long], 's');
    await selectAndChoose('Explain / Study this');
    await studyDone();
    const shortLen = screen.getByTestId('study-result').textContent.length;
    fireEvent.change(screen.getByLabelText('Study structure'), { target: { value: 'l' } });
    fireEvent.click(screen.getByText('Run again with current structure'));
    await screen.findByText(/L ·/);
    expect(screen.getByTestId('study-result').textContent.length).toBeGreaterThan(shortLen);
  });

  it('PYQs: retrieved from the user bank, labelled actual, and the model is never called', async () => {
    localStorage.setItem('studylens.pyq.v1', JSON.stringify([
      { id: 'f1', exam: 'JEE', year: 2002, question: '[FIXTURE] Where do the light reactions occur in the thylakoid membranes?', answer: 'Thylakoid', source: 'fixture' },
      { id: 'f2', exam: 'JEE', year: 2003, question: '[FIXTURE] Differentiate a polynomial.' },
    ]));
    store([makeProfile({ id: 'j', name: 'J', enabled: ['topic'], exam: 'JEE' })], 'j');
    await selectAndChoose('Find actual PYQs');
    const res = await screen.findByTestId('pyq-result');
    expect(res).toHaveTextContent('Actual previous-year questions');
    expect(res).toHaveTextContent('JEE 2002');
    expect(res).toHaveTextContent('[FIXTURE] Where do the light reactions');
    expect(res).not.toHaveTextContent('polynomial');
    expect(res).not.toHaveTextContent('AI-generated');
    fireEvent.click(screen.getByLabelText('Show PYQ answer 1'));
    expect(res).toHaveTextContent('Answer: Thylakoid');
    expect(prompts).toHaveLength(0);
  });

  it('PYQs: says plainly when no bank is loaded instead of inventing questions', async () => {
    await selectAndChoose('Find actual PYQs');
    expect(await screen.findByTestId('pyq-result')).toHaveTextContent('No PYQ bank is loaded yet');
    expect(prompts).toHaveLength(0);
  });

  it('Practice: AI-generated questions are rendered and clearly labelled as not real', async () => {
    await selectAndChoose('Generate practice questions');
    const res = await screen.findByTestId('practice-result');
    expect(res).toHaveTextContent('AI-generated practice questions, not actual exam questions');
    expect(res.querySelectorAll('.q').length).toBeGreaterThan(0);
    expect(prompts[0]).toContain('ACTION: practice');
    fireEvent.click(screen.getByLabelText('Show answer 1'));
    expect(res).toHaveTextContent('Answer:');
  });

  it('switching tabs keeps results and does not auto-run other actions', async () => {
    await selectAndChoose('Explain / Study this');
    await studyDone();
    fireEvent.click(screen.getByRole('tab', { name: 'PYQs' }));
    expect(screen.getByRole('button', { name: 'Find actual PYQs' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Study' }));
    expect(screen.getByTestId('study-result')).toBeInTheDocument();
    expect(prompts).toHaveLength(1);
  });

  it('shows a readable error and can retry', async () => {
    let n = 0;
    const flaky = { id: 'x', label: 'flaky', generate: async (p, o) => { n++; if (n === 1) throw new ProviderError('unreachable', 'Couldn’t reach Ollama at http://localhost:11434.'); return demoProvider.generate(p, o); } };
    await selectAndChoose('Explain / Study this', () => flaky);
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t reach Ollama');
    fireEvent.click(screen.getByText('Try again'));
    await studyDone();
    expect(n).toBe(2);
  });

  it('settings: choose Google and enter a key; choose demo and see its note', async () => {
    render(<App providerFactory={() => recording} />);
    fireEvent.click(screen.getByText('Settings'));
    const dlg = within(screen.getByRole('dialog', { name: 'Settings' }));
    fireEvent.change(dlg.getByLabelText('Model source'), { target: { value: 'google' } });
    fireEvent.change(dlg.getByLabelText('API key'), { target: { value: 'abc' } });
    expect(JSON.parse(localStorage.getItem('studylens.settings.v1'))).toMatchObject({ provider: 'google', googleKey: 'abc', googleModel: 'gemma-4-26b-a4b-it' });
    fireEvent.change(dlg.getByLabelText('Model source'), { target: { value: 'demo' } });
    expect(dlg.getByText(/does not explain anything/)).toBeInTheDocument();
  });

  it('shows the notes as the model wrote them, and warns when it ignored the structure', async () => {
    const off = { id: 'x', label: 'off', generate: async () => '## Topic / concept\nPhotosynthesis\n\n## Fun facts\n- plants are green' };
    await selectAndChoose('Explain / Study this', () => off);
    await studyDone();
    const res = screen.getByTestId('study-result');
    expect(res).toHaveTextContent('Photosynthesis');
    expect(res).toHaveTextContent('Fun facts');
    expect(screen.getByRole('note')).toHaveTextContent(/didn’t follow your structure.*missing.*extra: Fun facts/);
  });

  it('renders streamed text before the reply is complete', async () => {
    let release;
    const slow = { id: 's', label: 's', generate: (p, { onText }) => new Promise((resolve) => {
      onText('## Topic / concept\nThylakoid');
      release = () => resolve('## Topic / concept\nThylakoid membranes\n\n## One-line explanation\nDone.');
    }) };
    await selectAndChoose('Explain / Study this', () => slow);
    expect(await screen.findByText('Thylakoid')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Writing…');
    release();
    await screen.findByText('Thylakoid membranes');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
