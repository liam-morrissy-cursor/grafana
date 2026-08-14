import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { reportInteraction } from '@grafana/runtime';

import { Preview } from './Preview';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: function CodeEditor({ value }: { value: string }) {
    return <pre>{value}</pre>;
  },
}));

const rawSql = 'SELECT * FROM users LIMIT 50';

const setup = () => ({
  user: userEvent.setup({ advanceTimers: jest.advanceTimersByTime }),
  ...render(<Preview rawSql={rawSql} datasourceType="mysql" />),
});

const getCopyButton = () => screen.getByRole('button', { name: 'Copy to clipboard' });

describe('Preview', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
    document.execCommand = jest.fn().mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('confirms a successful copy and reverts to the copy affordance afterwards', async () => {
    const { user } = setup();

    await user.click(getCopyButton());

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy to clipboard' })).not.toBeInTheDocument();

    act(() => {
      jest.runAllTimers();
    });

    expect(getCopyButton()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
  });

  it('still reports the copy interaction', async () => {
    const { user } = setup();

    await user.click(getCopyButton());

    expect(reportInteraction).toHaveBeenCalledWith('grafana_sql_preview_copied', { datasource: 'mysql' });
  });

  it('restarts the confirmation window when copied again', async () => {
    const { user } = setup();

    await user.click(getCopyButton());
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    await user.click(screen.getByRole('button', { name: 'Copied' }));
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('does not confirm when the clipboard write fails', async () => {
    // copy-to-clipboard falls back to a manual prompt when execCommand fails.
    jest.mocked(document.execCommand).mockReturnValue(false);
    jest.spyOn(window, 'prompt').mockReturnValue(null);

    const { user } = setup();

    await user.click(getCopyButton());

    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
    expect(getCopyButton()).toBeInTheDocument();
  });
});
