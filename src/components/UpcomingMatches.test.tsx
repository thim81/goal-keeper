import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpcomingMatches } from '@/components/UpcomingMatches';

const matches = [
  {
    id: 'game|1',
    start: '2026-09-19T11:15:00.000Z',
    homeTeam: 'IPU15',
    awayTeam: 'Opponent U15',
    opponentName: 'Opponent U15',
    isHome: true,
  },
];

describe('UpcomingMatches', () => {
  it('hides itself until a successful response contains matches', () => {
    const { rerender } = render(
      <UpcomingMatches matches={[]} loaded={false} onSelect={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(screen.queryByText('Upcoming matches')).not.toBeInTheDocument();

    rerender(<UpcomingMatches matches={[]} loaded onSelect={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.queryByText('Upcoming matches')).not.toBeInTheDocument();
  });

  it('shows matches and emits the selected fixture', () => {
    const onSelect = vi.fn();
    render(<UpcomingMatches matches={matches} loaded onSelect={onSelect} onRefresh={vi.fn()} />);

    expect(screen.getByText('Upcoming matches')).toBeInTheDocument();
    expect(screen.getByText('Opponent U15')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Opponent U15'));
    expect(onSelect).toHaveBeenCalledWith(matches[0]);
  });

  it('disables the refresh button and spins the icon while refreshing', async () => {
    let resolveRefresh: () => void;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    render(<UpcomingMatches matches={matches} loaded onSelect={vi.fn()} onRefresh={onRefresh} />);

    const refreshButton = screen.getByLabelText('Refresh upcoming matches');
    fireEvent.click(refreshButton);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(refreshButton).toBeDisabled();
    expect(refreshButton.querySelector('svg')).toHaveClass('animate-spin');

    // A second click while refreshing must not trigger another refresh.
    fireEvent.click(refreshButton);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    resolveRefresh!();
    await screen.findByLabelText('Refresh upcoming matches');
    expect(refreshButton).not.toBeDisabled();
    expect(refreshButton.querySelector('svg')).not.toHaveClass('animate-spin');
  });
});
