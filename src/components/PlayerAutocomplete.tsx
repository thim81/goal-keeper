import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { getOpponentSuggestions } from '@/lib/opponent-suggestions';

interface PlayerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  players: string[];
  placeholder: string;
  autoFocus?: boolean;
  maxLength?: number;
  onEnter?: () => void;
  inputClassName?: string;
}

export function PlayerAutocomplete({
  value,
  onChange,
  players,
  placeholder,
  autoFocus,
  maxLength,
  onEnter,
  inputClassName,
}: PlayerAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestions = useMemo(() => getOpponentSuggestions(players, value), [players, value]);
  const isVisible = isOpen && suggestions.length > 0;

  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
  }, []);

  const handleSelect = (player: string) => {
    onChange(player);
    setIsOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isVisible) {
      if (event.key === 'ArrowDown' && suggestions.length > 0) {
        event.preventDefault();
        setIsOpen(true);
      } else if (event.key === 'Enter') {
        onEnter?.();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        className={cn(
          'w-full px-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary text-base',
          inputClassName,
        )}
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={maxLength}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isVisible}
        aria-controls="player-autocomplete-suggestions"
        aria-activedescendant={
          isVisible ? `player-autocomplete-suggestion-${activeIndex}` : undefined
        }
      />

      {isVisible && (
        <ul
          id="player-autocomplete-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 bg-secondary border border-border rounded-xl shadow-lg overflow-hidden z-10"
        >
          {suggestions.map((player, index) => (
            <li key={player} role="option" aria-selected={index === activeIndex}>
              <button
                id={`player-autocomplete-suggestion-${index}`}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(player)}
                className={`w-full px-4 py-3 text-left text-foreground transition-colors ${
                  index === activeIndex ? 'bg-primary/10 text-primary' : 'hover:bg-primary/20'
                } ${index !== suggestions.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                {player}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
