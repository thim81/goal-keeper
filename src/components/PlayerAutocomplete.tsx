import { useState, useRef, useEffect } from 'react';

interface PlayerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  players: string[];
  placeholder: string;
  autoFocus?: boolean;
}

export function PlayerAutocomplete({
  value,
  onChange,
  players,
  placeholder,
  autoFocus,
}: PlayerAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredPlayers, setFilteredPlayers] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.length > 0) {
      const filtered = players
        .filter(
          (player) =>
            player.toLowerCase().startsWith(value.toLowerCase()) &&
            player.toLowerCase() !== value.toLowerCase(),
        )
        .slice(0, 5);
      setFilteredPlayers(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setFilteredPlayers([]);
      setIsOpen(false);
    }
  }, [value, players]);

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
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (filteredPlayers.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        className="w-full px-4 py-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary text-lg"
        autoFocus={autoFocus}
        autoComplete="off"
      />

      {isOpen && filteredPlayers.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-secondary border border-border rounded-xl shadow-lg overflow-hidden z-10">
          {filteredPlayers.map((player, index) => (
            <button
              key={player}
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(player)}
              className={`w-full px-4 py-3 text-left text-foreground hover:bg-primary/20 transition-colors ${
                index !== filteredPlayers.length - 1 ? 'border-b border-border/50' : ''
              }`}
            >
              <span className="text-primary font-medium">{player.slice(0, value.length)}</span>
              <span>{player.slice(value.length)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
