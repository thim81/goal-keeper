import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MatchHistory } from './MatchHistory';
import type { MatchSummary } from '@/types/match';

const matches: MatchSummary[] = [
  {
    id: 'm1',
    myTeamName: 'My Team',
    opponentName: 'Rivals',
    isHome: true,
    myTeamScore: 2,
    opponentScore: 1,
    date: '1 Apr 2026',
    endedAt: 1,
  },
  {
    id: 'm2',
    myTeamName: 'My Team',
    opponentName: 'United',
    isHome: false,
    myTeamScore: 0,
    opponentScore: 3,
    date: '2 Apr 2026',
    endedAt: 2,
  },
];

function swipe(element: Element, distance: number) {
  fireEvent.pointerDown(element, { clientX: 0 });
  fireEvent.pointerMove(element, { clientX: distance });
  fireEvent.pointerUp(element);
}

describe('MatchHistory', () => {
  it('shows an empty state when there are no matches', () => {
    render(<MatchHistory matches={[]} onSelectMatch={vi.fn()} onDeleteMatch={vi.fn()} />);

    expect(screen.getByText('No matches yet')).toBeInTheDocument();
  });

  it('renders a result card for every match', () => {
    render(<MatchHistory matches={matches} onSelectMatch={vi.fn()} onDeleteMatch={vi.fn()} />);

    expect(screen.getByText('Rivals')).toBeInTheDocument();
    expect(screen.getByText('United')).toBeInTheDocument();
  });

  it('selects a match when its row is clicked without swiping', () => {
    const onSelectMatch = vi.fn();
    render(
      <MatchHistory matches={matches} onSelectMatch={onSelectMatch} onDeleteMatch={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('Rivals'));

    expect(onSelectMatch).toHaveBeenCalledWith('m1');
  });

  it('deletes a match after swiping its row past the reveal threshold', () => {
    const onDeleteMatch = vi.fn();
    render(
      <MatchHistory matches={matches} onSelectMatch={vi.fn()} onDeleteMatch={onDeleteMatch} />,
    );

    swipe(screen.getByText('Rivals'), -60);
    fireEvent.click(screen.getByRole('button', { name: /delete match/i }));

    expect(onDeleteMatch).toHaveBeenCalledWith('m1');
  });

  it('closes an open swipe on click instead of selecting the match', () => {
    const onSelectMatch = vi.fn();
    render(
      <MatchHistory matches={matches} onSelectMatch={onSelectMatch} onDeleteMatch={vi.fn()} />,
    );

    swipe(screen.getByText('Rivals'), -60);
    expect(screen.getByRole('button', { name: /delete match/i })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Rivals'));

    expect(onSelectMatch).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /delete match/i })).not.toBeInTheDocument();
  });
});
