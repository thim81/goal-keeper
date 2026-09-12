import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddEventSheet } from './AddEventSheet';

function renderSheet(overrides: Partial<Parameters<typeof AddEventSheet>[0]> = {}) {
  const handlers = { onClose: vi.fn(), onAddEvent: vi.fn() };
  render(
    <AddEventSheet
      isOpen
      onClose={handlers.onClose}
      onAddEvent={handlers.onAddEvent}
      myTeamName="My Team"
      opponentName="Rivals"
      knownPlayers={[]}
      {...overrides}
    />,
  );
  return handlers;
}

describe('AddEventSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AddEventSheet
        isOpen={false}
        onClose={vi.fn()}
        onAddEvent={vi.fn()}
        myTeamName="My Team"
        opponentName="Rivals"
        knownPlayers={[]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('adds a pause event and closes', () => {
    const handlers = renderSheet();

    fireEvent.click(screen.getByText('Pause Timer'));

    expect(handlers.onAddEvent).toHaveBeenCalledWith('pause');
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('adds a resume event and closes', () => {
    const handlers = renderSheet();

    fireEvent.click(screen.getByText('Resume Timer'));

    expect(handlers.onAddEvent).toHaveBeenCalledWith('resume');
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('defaults a card event to my-team with no player, and closes on submit', () => {
    const handlers = renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Yellow Card' }));
    fireEvent.click(screen.getByRole('button', { name: /add card event/i }));

    expect(handlers.onAddEvent).toHaveBeenCalledWith('yellow-card', {
      team: 'my-team',
      player: undefined,
    });
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('records a red card for the opponent with a player name', () => {
    const handlers = renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Red Card' }));
    fireEvent.click(screen.getByText('Rivals'));
    fireEvent.change(screen.getByPlaceholderText('Opponent player name'), {
      target: { value: 'Jones' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card event/i }));

    expect(handlers.onAddEvent).toHaveBeenCalledWith('red-card', {
      team: 'opponent',
      player: 'Jones',
    });
  });

  it('returns to the main menu from the card screen via Back without closing', () => {
    const handlers = renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Yellow Card' }));
    fireEvent.click(screen.getByText('Back'));

    expect(screen.getByText('Pause Timer')).toBeInTheDocument();
    expect(handlers.onClose).not.toHaveBeenCalled();
    expect(handlers.onAddEvent).not.toHaveBeenCalled();
  });
});
