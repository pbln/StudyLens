import { render, screen, fireEvent, within } from '@testing-library/react';
import App from './App.jsx';
import { demoProvider } from './lib/gemma/demoProvider.js';

const demo = () => demoProvider;

// pdf.js needs a real browser to draw, so the viewer and loader are faked here.
// Real PDF parsing is covered in lib/pdf.test.js.
vi.mock('./lib/pdf.js', () => ({
  loadPdf: vi.fn(async (data) => {
    if (data.length < 20) throw new Error('bad');
    return { numPages: 3 };
  }),
  pdfjs: {},
}));
vi.mock('./components/PdfViewer.jsx', () => ({
  default: ({ pdf }) => (
    <div>
      {Array.from({ length: pdf.numPages }, (_, i) => (
        <div key={i} data-page={i + 1}><span data-testid={`t${i + 1}`}>Light reactions occur in the thylakoid membranes.</span></div>
      ))}
    </div>
  ),
}));

function select(testId) {
  const range = document.createRange();
  range.selectNodeContents(screen.getByTestId(testId));
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

async function openSample() {
  render(<App providerFactory={demo} />);
  fireEvent.click(screen.getByText('Open sample'));
  await screen.findByTestId('t1');
}

beforeEach(() => localStorage.clear());

describe('Stage 1 flow', () => {
  it('opens a PDF and shows page count', async () => {
    await openSample();
    expect(screen.getByText('of 3')).toBeInTheDocument();
  });

  it('shows an error for an invalid file', async () => {
    render(<App providerFactory={demo} />);
    const file = new File(['tiny'], 'bad.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('PDF file'), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open');
  });

  it('right-click on selected text shows the menu; Study puts it in the panel with its page', async () => {
    await openSample();
    select('t2');
    fireEvent.contextMenu(screen.getByTestId('t2'), { clientX: 50, clientY: 60 });
    const menu = screen.getByRole('menu');
    fireEvent.click(within(menu).getByText('Explain / Study this'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByTestId('active-text')).toHaveTextContent('Light reactions occur in the thylakoid membranes.');
    expect(screen.getByText(/Page 2/)).toBeInTheDocument();
    await screen.findByTestId('study-result');
  });

  it('does not open the custom menu when nothing is selected', async () => {
    await openSample();
    window.getSelection().removeAllRanges();
    fireEvent.contextMenu(screen.getByTestId('t1'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes the menu on Escape', async () => {
    await openSample();
    select('t1');
    fireEvent.contextMenu(screen.getByTestId('t1'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps earlier selections and lets you switch and remove them', async () => {
    await openSample();
    for (const id of ['t1', 't3']) {
      select(id);
      fireEvent.contextMenu(screen.getByTestId(id));
      fireEvent.click(screen.getByText('Explain / Study this'));
      await screen.findByTestId('study-result');
    }
    expect(screen.getByText(/Page 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('p. 1'));
    expect(screen.getByText(/Page 1/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Remove')[1]);
    expect(screen.queryByText('p. 1')).toBeNull();
  });

  it('page navigation updates the page number', async () => {
    await openSample();
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByLabelText('Page number')).toHaveValue(2);
    expect(screen.getByLabelText('Previous page')).toBeEnabled();
  });

  it('toggles the side panel and persists settings', async () => {
    await openSample();
    fireEvent.click(screen.getByText('Side panel'));
    expect(screen.queryByLabelText('StudyLens panel')).toBeNull();
    fireEvent.click(screen.getByText('Settings'));
    fireEvent.change(screen.getByLabelText('Default zoom'), { target: { value: '1.5' } });
    expect(JSON.parse(localStorage.getItem('studylens.settings.v1')).defaultZoom).toBe(1.5);
  });
});
