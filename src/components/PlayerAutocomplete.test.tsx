// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { PlayerAutocomplete } from './PlayerAutocomplete';

describe('PlayerAutocomplete', () => {
  afterEach(cleanup);

  it('shows matching multi-word suggestions after one character and keeps free input editable', () => {
    const onChange = vi.fn();

    function Harness() {
      const [value, setValue] = useState('');
      return (
        <PlayerAutocomplete
          value={value}
          onChange={(nextValue) => {
            onChange(nextValue);
            setValue(nextValue);
          }}
          players={['Royal Antwerp']}
          placeholder="Opponent"
        />
      );
    }

    render(<Harness />);
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'r' } });
    expect(screen.getByRole('option', { name: 'Royal Antwerp' })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'royal a' } });
    expect(screen.getByRole('option', { name: 'Royal Antwerp' })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'New Opponent' } });
    expect(input).toHaveValue('New Opponent');
    expect(onChange).toHaveBeenLastCalledWith('New Opponent');
  });

  it('selects the active suggestion with the keyboard and dismisses with Escape', () => {
    const onChange = vi.fn();

    function Harness() {
      const [value, setValue] = useState('');
      return (
        <PlayerAutocomplete
          value={value}
          onChange={(nextValue) => {
            onChange(nextValue);
            setValue(nextValue);
          }}
          players={['FC United', 'United FC']}
          placeholder="Opponent"
        />
      );
    }

    render(<Harness />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'un' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith('FC United');
    expect(input).toHaveValue('FC United');

    fireEvent.change(input, { target: { value: 'un' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
