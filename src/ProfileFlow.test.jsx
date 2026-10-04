import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import App from './App.jsx';

vi.mock('./lib/pdf.js', () => ({ loadPdf: vi.fn(), pdfjs: {} }));

const preview = () => within(screen.getByTestId('structure-preview'));
const order = () => preview().getAllByRole('listitem').map((li) => li.textContent);
const openEditor = () => {
  fireEvent.click(screen.getByText('Edit structures'));
  return within(screen.getByRole('dialog', { name: 'Study structures' }));
};
const stored = () => JSON.parse(localStorage.getItem('studylens.profiles.v1'));

beforeEach(() => { localStorage.clear(); window.confirm = vi.fn(() => true); });

describe('Stage 2: study structures', () => {
  it('starts on Quick Revision and shows its sections in order', () => {
    render(<App />);
    expect(screen.getByLabelText('Study structure')).toHaveValue('preset-quick');
    expect(order()).toEqual(['Topic / concept', 'One-line explanation', 'Key points', 'Important terms', 'Exam takeaway']);
  });

  it('switching presets changes the structure', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Study structure'), { target: { value: 'preset-understand' } });
    expect(order()[2]).toBe('Why / how explanation');
    fireEvent.change(screen.getByLabelText('Study structure'), { target: { value: 'preset-exam' } });
    expect(order()).toContain('Exam relevance');
    expect(preview().getByText(/JEE/)).toBeInTheDocument();
  });

  it('a preset can be edited and kept as your own structure; the preset itself never changes', () => {
    render(<App />);
    const ed = openEditor();
    expect(ed.getByLabelText('Include Examples')).toBeEnabled();
    expect(ed.getByText('Save as my structure and use')).toBeDisabled();
    fireEvent.click(ed.getByLabelText('Include Examples'));
    fireEvent.click(ed.getByText('Save as my structure and use'));
    expect(ed.getByRole('status')).toHaveTextContent('Saved. This structure is now in use.');
    fireEvent.click(ed.getByText('Done'));
    expect(screen.getByLabelText('Study structure')).toHaveDisplayValue('My Quick Revision');
    expect(order()).toContain('Examples');
    fireEvent.change(screen.getByLabelText('Study structure'), { target: { value: 'preset-quick' } });
    expect(order()).toEqual(['Topic / concept', 'One-line explanation', 'Key points', 'Important terms', 'Exam takeaway']);
  });

  it('saving an existing structure makes it the one in use straight away', () => {
    render(<App />);
    const ed = openEditor();
    fireEvent.click(ed.getByText('New structure'));
    fireEvent.click(ed.getByLabelText('Include Memory tricks'));
    fireEvent.click(ed.getByText('Save and use'));
    fireEvent.click(ed.getByText('Done'));
    expect(screen.getByLabelText('Study structure')).toHaveDisplayValue('My structure');
    expect(order()).toContain('Memory tricks');
    expect(stored().activeId).toBe(stored().custom[0].id);
  });

  it('warns when the browser blocks storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<App />);
    const ed = openEditor();
    expect(ed.getByRole('alert')).toHaveTextContent(/blocking storage/);
    spy.mockRestore();
  });

  it('exports are importable: a structures file adds your structures', async () => {
    render(<App />);
    const ed = openEditor();
    const file = new File([JSON.stringify({ profiles: [{ name: 'From backup', depth: 'short', sections: [{ id: 'memory', enabled: true }] }, 'junk'] })], 's.json', { type: 'application/json' });
    fireEvent.change(ed.getByLabelText('Structures file'), { target: { files: [file] } });
    expect(await ed.findByText('Imported 1 structure(s).')).toBeInTheDocument();
    expect(ed.getByText('From backup')).toBeInTheDocument();
    expect(stored().custom[0]).toMatchObject({ name: 'From backup', depth: 'short' });
  });

  it('creates, edits, reorders, saves, persists and reloads a custom structure', () => {
    const { unmount } = render(<App />);
    const ed = openEditor();
    fireEvent.click(ed.getByText('New structure'));
    fireEvent.change(ed.getByLabelText('Name'), { target: { value: 'Banking sprint' } });
    fireEvent.click(ed.getByLabelText('Include Examples'));
    for (let i = 0; i < 3; i++) fireEvent.click(ed.getByLabelText('Move Examples up'));
    fireEvent.change(ed.getByLabelText('Target exam'), { target: { value: 'Custom' } });
    expect(ed.getByText('Enter the name of your exam.')).toBeInTheDocument();
    expect(ed.getByText('Save and use')).toBeDisabled();
    fireEvent.change(ed.getByLabelText('Exam name'), { target: { value: 'RBI Grade B' } });
    fireEvent.change(ed.getByLabelText('Explanation depth'), { target: { value: 'detailed' } });
    fireEvent.change(ed.getByLabelText('Language'), { target: { value: 'hinglish' } });
    fireEvent.change(ed.getByLabelText('Max key points'), { target: { value: '4' } });
    fireEvent.click(ed.getByText('Save and use'));
    fireEvent.click(ed.getByText('Done'));

    expect(screen.getByLabelText('Study structure')).toHaveDisplayValue('Banking sprint');
    expect(order()).toEqual(['Topic / concept', 'One-line explanation', 'Key points', 'Examples']);
    expect(preview().getByText(/RBI Grade B · Detailed depth · Hinglish · up to 4 key points/)).toBeInTheDocument();

    // Stored as structured data, not display text.
    const saved = stored().custom[0];
    expect(saved).toMatchObject({
      name: 'Banking sprint', language: 'hinglish', depth: 'detailed', maxKeyPoints: 4,
      targetExam: { type: 'Custom', custom: 'RBI Grade B' },
    });
    expect(saved.sections.filter((s) => s.enabled).map((s) => s.id)).toEqual(['topic', 'one_line', 'key_points', 'examples']);

    // Reload: same profile still active, same structure.
    unmount();
    render(<App />);
    expect(screen.getByLabelText('Study structure')).toHaveDisplayValue('Banking sprint');
    expect(order()).toEqual(['Topic / concept', 'One-line explanation', 'Key points', 'Examples']);
  });

  it('unsaved edits do not change the panel until saved, and can be discarded', () => {
    render(<App />);
    const ed = openEditor();
    fireEvent.click(ed.getByText('New structure'));
    fireEvent.click(ed.getByLabelText('Include Memory tricks'));
    fireEvent.click(ed.getByText('Discard changes'));
    expect(ed.getByLabelText('Include Memory tricks')).not.toBeChecked();
    expect(ed.getByText('Save and use')).toBeDisabled();
  });

  it('blocks saving with no sections on', () => {
    render(<App />);
    const ed = openEditor();
    fireEvent.click(ed.getByText('New structure'));
    for (const l of ['Topic / concept', 'One-line explanation', 'Key points']) fireEvent.click(ed.getByLabelText(`Include ${l}`));
    expect(ed.getByText('Turn on at least one section.')).toBeInTheDocument();
    expect(ed.getByText('Save and use')).toBeDisabled();
  });

  it('switches between saved profiles from the panel', () => {
    render(<App />);
    let ed = openEditor();
    fireEvent.click(ed.getByText('New structure'));
    fireEvent.click(ed.getByText('Done'));
    fireEvent.change(screen.getByLabelText('Study structure'), { target: { value: stored().custom[0].id } });
    expect(order()).toEqual(['Topic / concept', 'One-line explanation', 'Key points']);
    fireEvent.change(screen.getByLabelText('Study structure'), { target: { value: 'preset-quick' } });
    expect(order()).toHaveLength(5);
  });

  it('deleting the active custom profile falls back to a preset', () => {
    render(<App />);
    const ed = openEditor();
    fireEvent.click(ed.getByText('New structure'));
    fireEvent.click(ed.getByText('Use this structure'));
    fireEvent.click(ed.getByText('Delete'));
    fireEvent.click(ed.getByText('Done'));
    expect(screen.getByLabelText('Study structure')).toHaveValue('preset-quick');
    expect(stored().custom).toEqual([]);
  });

  it('survives corrupt stored data', () => {
    localStorage.setItem('studylens.profiles.v1', '{not json');
    render(<App />);
    expect(screen.getByLabelText('Study structure')).toHaveValue('preset-quick');
    cleanup();
    localStorage.setItem('studylens.profiles.v1', JSON.stringify({ activeId: 'gone', custom: [{ name: 'Odd', sections: 5 }, null] }));
    render(<App />);
    expect(screen.getByLabelText('Study structure')).toHaveValue('preset-quick');
    expect(screen.getByText('Odd')).toBeInTheDocument();
  });
});
