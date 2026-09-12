// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Index from './Index';

describe('Index match flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts a match, scores a goal, ends it, and shows the result on home', async () => {
    render(<Index />);

    fireEvent.click(await screen.findByRole('button', { name: /start new match/i }));

    fireEvent.change(screen.getByPlaceholderText('Opponent'), {
      target: { value: 'Rivals' },
    });
    fireEvent.click(screen.getByRole('button', { name: /kick off/i }));

    await screen.findByText('⚽ Goal Keeper');

    fireEvent.click(screen.getByRole('button', { name: /we scored!/i }));
    fireEvent.change(screen.getByPlaceholderText('Who scored?'), {
      target: { value: 'Alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add goal$/i }));

    fireEvent.click(screen.getByRole('button', { name: /show extra actions/i }));
    fireEvent.click(screen.getByRole('button', { name: /^end$/i }));

    const resultCard = await screen.findByText('Rivals');
    expect(resultCard.closest('button')).toHaveTextContent('WIN');
    expect(resultCard.closest('button')).toHaveTextContent('1');
  });

  it('prefills and starts a match selected from the upcoming calendar list', async () => {
    localStorage.setItem(
      'football-tracker-settings',
      JSON.stringify({
        teamName: 'My Team',
        calendarUrl: 'https://club.prosoccerdata.com/api/v2/members/ics/file?id=1&uuid=x',
        calendarTeamName: 'My Team',
        players: [],
        periodsCount: 4,
        periodDuration: 20,
        theme: 'system',
        debug: false,
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            games: [
              {
                id: 'game|1',
                start: new Date(Date.now() + 86_400_000).toISOString(),
                homeTeam: 'Rivals FC',
                awayTeam: 'My Team',
              },
            ],
          }),
        ),
      ),
    );

    render(<Index />);

    fireEvent.click(await screen.findByText('Rivals FC'));

    const opponentInput = await screen.findByPlaceholderText('Opponent');
    await waitFor(() => expect(opponentInput).toHaveValue('Rivals FC'));

    fireEvent.click(screen.getByRole('button', { name: /kick off/i }));

    await screen.findByText('⚽ Goal Keeper');
    expect(screen.getAllByText('Rivals FC').length).toBeGreaterThan(0);
  });
});
