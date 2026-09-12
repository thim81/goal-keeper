import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddOpponentGoalSheet } from './AddOpponentGoalSheet';

describe('AddOpponentGoalSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AddOpponentGoalSheet
        isOpen={false}
        onClose={vi.fn()}
        onAddGoal={vi.fn()}
        opponentName="Rivals"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to a normal goal and closes on submit', () => {
    const onAddGoal = vi.fn();
    const onClose = vi.fn();
    render(
      <AddOpponentGoalSheet isOpen onClose={onClose} onAddGoal={onAddGoal} opponentName="Rivals" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /add goal/i }));

    expect(onAddGoal).toHaveBeenCalledWith('normal');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits the selected goal type', () => {
    const onAddGoal = vi.fn();
    render(
      <AddOpponentGoalSheet isOpen onClose={vi.fn()} onAddGoal={onAddGoal} opponentName="Rivals" />,
    );

    fireEvent.click(screen.getByText('Own Goal'));
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }));

    expect(onAddGoal).toHaveBeenCalledWith('own-goal');
  });

  it('shows the opponent name in the header', () => {
    render(
      <AddOpponentGoalSheet isOpen onClose={vi.fn()} onAddGoal={vi.fn()} opponentName="Rivals" />,
    );

    expect(screen.getByText('Rivals Goal')).toBeInTheDocument();
  });
});
