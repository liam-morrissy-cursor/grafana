import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { Preview } from './Preview';

type MockCodeEditorProps = {
  value?: string;
  height?: number | string;
  monacoOptions?: { scrollbar?: { vertical?: string } };
};

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual<Record<string, unknown>>('@grafana/ui'),
  CodeEditor: function CodeEditor({ value, height, monacoOptions }: MockCodeEditorProps) {
    return (
      <pre
        data-testid="mock-code-editor"
        data-height={height}
        data-vertical-scrollbar={monacoOptions?.scrollbar?.vertical}
      >
        {value}
      </pre>
    );
  },
}));

const rawSql = 'SELECT * FROM users LIMIT 50';

const setup = () => ({
  user: userEvent.setup(),
  ...render(<Preview rawSql={rawSql} datasourceType="mysql" />),
});

const getEditor = () => screen.getByTestId('mock-code-editor');
const getToggle = () => screen.getByTestId(selectors.components.SQLQueryEditor.previewToggleExpand);

describe('Preview', () => {
  it('renders collapsed with the vertical scrollbar hidden', () => {
    setup();

    expect(getEditor()).toHaveAttribute('data-height', '80');
    expect(getEditor()).toHaveAttribute('data-vertical-scrollbar', 'hidden');
    expect(getToggle()).toHaveAccessibleName('Expand preview');
    expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('grows the editor and enables the vertical scrollbar when expanded', async () => {
    const { user } = setup();

    await user.click(getToggle());

    expect(getEditor()).toHaveAttribute('data-height', '240');
    expect(getEditor()).toHaveAttribute('data-vertical-scrollbar', 'auto');
    expect(getToggle()).toHaveAccessibleName('Collapse preview');
    expect(getToggle()).toHaveAttribute('aria-expanded', 'true');
  });

  it('returns to the compact height when collapsed again', async () => {
    const { user } = setup();

    await user.click(getToggle());
    await user.click(getToggle());

    expect(getEditor()).toHaveAttribute('data-height', '80');
    expect(getEditor()).toHaveAttribute('data-vertical-scrollbar', 'hidden');
    expect(getToggle()).toHaveAccessibleName('Expand preview');
    expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the generated SQL and the copy control available in both states', async () => {
    const { user } = setup();

    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeInTheDocument();
    expect(getEditor()).toHaveTextContent('SELECT');

    await user.click(getToggle());

    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeInTheDocument();
    expect(getEditor()).toHaveTextContent('SELECT');
  });
});
