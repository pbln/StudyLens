import { render, screen } from '@testing-library/react';
import Markdown, { parseBlocks } from './Markdown.jsx';

it('renders headings, bullets, numbered steps, bold terms and paragraphs', () => {
  render(<Markdown text={'## Key points\n- one\n- two\n\n## Process or flow\n1. first\n2. second\n\n## Important terms\n- **ATP**: energy carrier\n\n## Topic / concept\nPlain text'} />);
  expect(screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual(['Key points', 'Process or flow', 'Important terms', 'Topic / concept']);
  expect(screen.getAllByRole('listitem')).toHaveLength(5);
  expect(screen.getByText('ATP').tagName).toBe('STRONG');
  expect(screen.getByText('Plain text')).toBeInTheDocument();
});
it('shows model-written HTML as plain text, never as markup', () => {
  const { container } = render(<Markdown text={'## A\n- <img src=x onerror=alert(1)> hi'} />);
  expect(container.querySelector('img')).toBeNull();
  expect(container).toHaveTextContent('<img src=x onerror=alert(1)> hi');
});
it('copes with half-finished streamed text', () => {
  expect(parseBlocks('## Key points\n- one\n- tw')).toEqual([{ t: 'h', text: 'Key points' }, { t: 'ul', items: ['one', 'tw'] }]);
  render(<Markdown text={'## Key po'} />);
});
