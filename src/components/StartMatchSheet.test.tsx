import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StartMatchSheet } from '@/components/StartMatchSheet';

describe('StartMatchSheet scheduled match defaults', () => {
  it('prefills the opponent and away selection when supplied', () => {
    render(
      <StartMatchSheet
        isOpen
        onClose={vi.fn()}
        onStartMatch={vi.fn()}
        defaultTeamName="IPU15"
        initialOpponentName="Opponent U15"
        initialIsHome={false}
      />,
    );

    expect(screen.getByPlaceholderText('Opponent')).toHaveValue('Opponent U15');
    expect(screen.getByText('Away').closest('button')).toHaveClass('border-primary');
  });

  it('keeps scheduled defaults editable', () => {
    const onStartMatch = vi.fn();
    render(
      <StartMatchSheet
        isOpen
        onClose={vi.fn()}
        onStartMatch={onStartMatch}
        initialOpponentName="Opponent U15"
        initialIsHome
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Opponent'), { target: { value: 'Changed U15' } });
    fireEvent.click(screen.getByText('Kick Off!'));

    expect(onStartMatch).toHaveBeenCalledWith('My Team', 'Changed U15', true);
  });
});
