import { useState } from 'react';
import { CalendarDays, ChevronRight, RefreshCw } from 'lucide-react';
import type { UpcomingMatch } from '@/lib/upcoming-matches';

interface UpcomingMatchesProps {
  matches: UpcomingMatch[];
  loaded: boolean;
  onSelect: (match: UpcomingMatch) => void;
  onRefresh: () => Promise<void>;
}

export function UpcomingMatches({ matches, loaded, onSelect, onRefresh }: UpcomingMatchesProps) {
  const [refreshing, setRefreshing] = useState(false);

  if (!loaded || matches.length === 0) return null;

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="w-full max-w-xs mt-6 card-gradient rounded-xl border border-border/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Upcoming matches</h2>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          aria-label="Refresh upcoming matches"
          className="p-1.5 rounded-full hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="divide-y divide-border/30">
        {matches.slice(0, 2).map((match) => {
          const start = new Date(match.start);
          return (
            <button
              key={match.id}
              type="button"
              onClick={() => onSelect(match)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
            >
              <div className="w-14 shrink-0 text-center">
                <div className="text-xs font-semibold text-foreground">
                  {start.toLocaleDateString('nl-BE', { weekday: 'short' })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {start.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {start.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground">{match.opponentName}</div>
                <div className="text-xs text-muted-foreground">{match.isHome ? 'Home' : 'Away'}</div>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
