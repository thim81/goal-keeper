import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoalTimeline } from './GoalTimeline';
import type { Goal, GameEvent } from '@/types/match';

const goal: Goal = {
  id: 'g1',
  team: 'my-team',
  scorer: 'Alice',
  type: 'normal',
  time: '10:00',
  timestamp: 1000,
};

const event: GameEvent = {
  id: 'e1',
  type: 'yellow-card',
  team: 'opponent',
  player: 'Bob',
  time: '20:00',
  timestamp: 2000,
};

function swipe(element: Element, distance: number) {
  fireEvent.pointerDown(element, { clientX: 0 });
  fireEvent.pointerMove(element, { clientX: distance });
  fireEvent.pointerUp(element);
}

describe('GoalTimeline', () => {
  it('shows an empty state when there are no goals or events', () => {
    render(
      <GoalTimeline goals={[]} events={[]} myTeamName="My Team" opponentName="Rivals" editable />,
    );

    expect(screen.getByText('No goals yet')).toBeInTheDocument();
  });

  it('renders goals and events ordered by timestamp', () => {
    const earlierEvent: GameEvent = { ...event, id: 'e0', timestamp: 500, type: 'start' };
    render(
      <GoalTimeline
        goals={[goal]}
        events={[event, earlierEvent]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
      />,
    );

    const rows = screen.getAllByText(/Match Started|Alice|Bob/);
    const order = rows.map((el) => el.textContent);
    expect(order.indexOf('Match Started')).toBeLessThan(order.findIndex((t) => t?.includes('Alice')));
    expect(order.findIndex((t) => t?.includes('Alice'))).toBeLessThan(
      order.findIndex((t) => t?.includes('Bob')),
    );
  });

  it('deletes a goal after swiping its row past the reveal threshold', () => {
    const onDeleteGoal = vi.fn();
    render(
      <GoalTimeline
        goals={[goal]}
        events={[]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
        onDeleteGoal={onDeleteGoal}
      />,
    );

    swipe(screen.getByText('Alice'), -60);
    fireEvent.click(screen.getByRole('button', { name: /delete goal/i }));

    expect(onDeleteGoal).toHaveBeenCalledWith('g1');
  });

  it('deletes an event after swiping its row past the reveal threshold', () => {
    const onDeleteEvent = vi.fn();
    render(
      <GoalTimeline
        goals={[]}
        events={[event]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
        onDeleteEvent={onDeleteEvent}
      />,
    );

    swipe(screen.getByText(/Bob/), -60);
    fireEvent.click(screen.getByRole('button', { name: /delete event/i }));

    expect(onDeleteEvent).toHaveBeenCalledWith('e1');
  });

  it('does not reveal a delete action when a swipe does not clear the threshold', () => {
    const onDeleteGoal = vi.fn();
    render(
      <GoalTimeline
        goals={[goal]}
        events={[]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
        onDeleteGoal={onDeleteGoal}
      />,
    );

    swipe(screen.getByText('Alice'), -10);

    expect(screen.queryByRole('button', { name: /delete goal/i })).not.toBeInTheDocument();
  });

  it('does not allow swipe-to-delete when not editable', () => {
    render(
      <GoalTimeline
        goals={[goal]}
        events={[]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable={false}
        onDeleteGoal={vi.fn()}
      />,
    );

    swipe(screen.getByText('Alice'), -60);

    expect(screen.queryByRole('button', { name: /delete goal/i })).not.toBeInTheDocument();
  });
});
