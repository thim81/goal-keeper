// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchSummary } from '@/types/match';
import { MatchResultCard } from './MatchResultCard';

const match: MatchSummary = {
  id: 'match-1',
  myTeamName: 'My Team',
  opponentName: 'Royal Antwerp',
  isHome: false,
  myTeamScore: 3,
  opponentScore: 1,
  date: '05/09/2026',
  endedAt: Date.parse('2026-09-05T12:00:00.000Z'),
};

describe('MatchResultCard', () => {
  it('renders the result, score, and home-away ordering', () => {
    render(<MatchResultCard match={match} onSelect={vi.fn()} />);

    expect(screen.getByText('WIN')).toBeInTheDocument();
    expect(screen.getByText('Royal Antwerp')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Royal Antwerp').parentElement).toHaveTextContent(
      'Royal Antwerp1-3My Team',
    );
  });

  it('calls onSelect when the card is clicked', () => {
    const onSelect = vi.fn();
    render(<MatchResultCard match={match} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledOnce();
  });
});
