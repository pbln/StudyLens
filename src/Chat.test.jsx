import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import App from './App.jsx';
import { demoProvider } from './lib/gemma/demoProvider.js';

vi.mock('./lib/pdf.js', () => ({
  loadPdf: vi.fn(async () => ({
    numPages: 3,
    getPage: async (n) => ({ getTextContent: async () => ({ items: [
      { str: `On page ${n}, photosynthesis happens in chloroplasts.`, hasEOL: false },
      { str: 'Light reactions need sunlight.', hasEOL: true },
    ] }) }),
  })),
  pdfjs: {},
}));
vi.mock('./components/PdfViewer.jsx', () => ({
  default: () => <div data-page="2"><span data-testid="t1">Light reactions occur in the thylakoid membranes.</span></div>,
}));

let prompts;
const recording = { ...demoProvider, generate: async (p, o) => { prompts.push(p); return demoProvider.generate(p, o); } };

async function openAsk(factory = () => recording) {
  const utils = render(<App providerFactory={factory} />);
  fireEvent.click(screen.getByText('Open sample'));
  await screen.findByTestId('t1');
  fireEvent.click(screen.getByRole('button', { name: 'Ask doubts' }));
  return utils;
}
const ask = (q) => {
  fireEvent.change(screen.getByLabelText('Your doubt'), { target: { value: q } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
};
const userBubbles = () => document.querySelectorAll('.msg.user').length;

beforeEach(() => { localStorage.clear(); prompts = []; Element.prototype.scrollIntoView = vi.fn(); });

describe('Ask doubts chat', () => {
  it('needs a PDF', () => {
    render(<App providerFactory={() => recording} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask doubts' }));
    expect(screen.getByText(/Open a PDF to ask questions/)).toBeInTheDocument();
    expect(screen.getByLabelText('Your doubt')).toBeDisabled();
  });

  it('answers from the current page, and sends only that page', async () => {
    await openAsk();
    ask('Where does photosynthesis happen?');
    expect(await screen.findByText(/in chloroplasts/)).toBeInTheDocument();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('PAGE 1 EXCERPT');
    expect(prompts[0]).toContain('On page 1, photosynthesis happens in chloroplasts.');
    expect(prompts[0]).not.toContain('On page 2');
    expect(prompts[0].endsWith('Where does photosynthesis happen?')).toBe(true);
    expect(screen.getByLabelText('Your doubt')).toHaveValue('');
  });

  it('keeps the conversation: follow-ups carry earlier turns', async () => {
    await openAsk();
    ask('Where does photosynthesis happen?');
    await screen.findByText(/in chloroplasts/);
    ask('And what do light reactions need?');
    await waitFor(() => expect(prompts).toHaveLength(2));
    expect(prompts[1]).toContain('Student: Where does photosynthesis happen?');
    expect(prompts[1]).toContain('StudyLens: From this page');
    await screen.findByText(/need sunlight/);
    expect(userBubbles()).toBe(2);
  });

  it('uses the page the student has navigated to', async () => {
    await openAsk();
    fireEvent.click(screen.getByLabelText('Next page'));
    ask('What happens here?');
    await waitFor(() => expect(prompts).toHaveLength(1));
    expect(prompts[0]).toContain('PAGE 2 EXCERPT');
  });

  it('right-click > Ask a doubt about this attaches the selection to the next question', async () => {
    render(<App providerFactory={() => recording} />);
    fireEvent.click(screen.getByText('Open sample'));
    const span = await screen.findByTestId('t1');
    const range = document.createRange(); range.selectNodeContents(span);
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
    fireEvent.contextMenu(span);
    fireEvent.click(within(screen.getByRole('menu')).getByText('Ask a doubt about this'));
    expect(screen.getByLabelText('Your doubt')).toBeInTheDocument();
    expect(within(document.querySelector('.pinned')).getByText(/Light reactions occur in the thylakoid/)).toBeInTheDocument();
    ask('Why thylakoid?');
    await waitFor(() => expect(prompts).toHaveLength(1));
    expect(prompts[0]).toContain('STUDENT\'S SELECTED TEXT\n<<<\nLight reactions occur in the thylakoid membranes.\n>>>');
    expect(prompts[0]).toContain('PAGE 2 EXCERPT');
    expect(screen.queryByLabelText('Remove selected text')).toBeNull();
  });

  it('remembers the chat for this PDF after a reload, and New chat clears it', async () => {
    const { unmount } = await openAsk();
    ask('Where does photosynthesis happen?');
    await screen.findByText(/in chloroplasts/);
    unmount();
    await openAsk();
    expect(screen.getByText('Where does photosynthesis happen?')).toBeInTheDocument();
    expect(screen.getByText(/in chloroplasts/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('New chat'));
    expect(screen.queryByText('Where does photosynthesis happen?')).toBeNull();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('studylens.chat'))))).toEqual([]));
  });

  it('shows errors and retries without duplicating the question', async () => {
    let n = 0;
    const flaky = { id: 'f', label: 'f', generate: async (p, o) => { n++; if (n === 1) throw new Error('Couldn’t reach Ollama.'); return demoProvider.generate(p, o); } };
    await openAsk(() => flaky);
    ask('Where does photosynthesis happen?');
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t reach Ollama.');
    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByText(/in chloroplasts/)).toBeInTheDocument();
    expect(userBubbles()).toBe(1);
    expect(n).toBe(2);
  });

  it('can be stopped while the model is answering', async () => {
    const slow = { id: 's', label: 's', generate: (p, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }) };
    await openAsk(() => slow);
    ask('Anything');
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    expect(await screen.findByText('Stopped.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('switching back to Notes keeps the notes view working', async () => {
    await openAsk();
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByLabelText('Study structure')).toBeInTheDocument();
  });
});
