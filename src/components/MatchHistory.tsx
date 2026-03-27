import { useRef, useState } from 'react';
import { ChevronRight, Trophy, Trash2 } from 'lucide-react';
import { MatchSummary } from '@/types/match';

interface MatchHistoryProps {
  matches: MatchSummary[];
  onSelectMatch: (matchId: string) => void;
  onDeleteMatch: (matchId: string) => void;
}

export function MatchHistory({ matches, onSelectMatch, onDeleteMatch }: MatchHistoryProps) {
  const MAX_SWIPE_PX = 84;
  const SWIPE_SNAP_THRESHOLD = 42;
  const [matchSwipeX, setMatchSwipeX] = useState<Record<string, number>>({});
  const activeMatchIdRef = useRef<string | null>(null);
  const startXRef = useRef(0);
  const startSwipeRef = useRef(0);
  const draggingRef = useRef(false);
  const didSwipeRef = useRef(false);

  const onMatchPointerDown = (matchId: string) => (e: React.PointerEvent) => {
    draggingRef.current = true;
    didSwipeRef.current = false;
    activeMatchIdRef.current = matchId;
    startXRef.current = e.clientX;
    startSwipeRef.current = matchSwipeX[matchId] ?? 0;

    // Close other rows when starting a new swipe
    setMatchSwipeX((prev) => {
      const next: Record<string, number> = {};
      if (prev[matchId]) next[matchId] = prev[matchId];
      return next;
    });

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onMatchPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const matchId = activeMatchIdRef.current;
    if (!matchId) return;

    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 6) didSwipeRef.current = true;

    // only allow swiping left to reveal
    const nextX = Math.max(-MAX_SWIPE_PX, Math.min(0, startSwipeRef.current + dx));
    setMatchSwipeX((prev) => ({ ...prev, [matchId]: nextX }));
  };

  const onMatchPointerEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    const matchId = activeMatchIdRef.current;
    activeMatchIdRef.current = null;
    if (!matchId) return;

    const currentX = matchSwipeX[matchId] ?? 0;
    const shouldReveal = Math.abs(currentX) >= SWIPE_SNAP_THRESHOLD;
    setMatchSwipeX((prev) => ({ ...prev, [matchId]: shouldReveal ? -MAX_SWIPE_PX : 0 }));
  };

  if (matches.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">No matches yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            Start your first match to track goals!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto overscroll-none"
      style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="space-y-3">
        {matches.map((match, index) => {
          const isWin = match.myTeamScore > match.opponentScore;
          const isDraw = match.myTeamScore === match.opponentScore;
          const resultColor = isWin ? 'text-primary' : isDraw ? 'text-goal' : 'text-accent';
          const resultBg = isWin ? 'bg-primary/10' : isDraw ? 'bg-goal/10' : 'bg-accent/10';

          const swipeX = matchSwipeX[match.id] ?? 0;

          return (
            <div
              key={match.id}
              className="animate-slide-up card-gradient rounded-xl border border-border/30 overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="relative overflow-hidden border-b border-border/30">
                {swipeX !== 0 && (
                  <button
                    onClick={() => {
                      setMatchSwipeX((prev) => ({ ...prev, [match.id]: 0 }));
                      onDeleteMatch(match.id);
                    }}
                    className="absolute inset-y-0 right-0 w-[84px] bg-accent text-accent-foreground flex items-center justify-center"
                    aria-label="Delete match"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}

              <button
                onClick={(e) => {
                  if (didSwipeRef.current || swipeX !== 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    didSwipeRef.current = false;
                    if (swipeX !== 0) {
                      setMatchSwipeX((prev) => ({ ...prev, [match.id]: 0 }));
                    }
                    return;
                  }

                  onSelectMatch(match.id);
                }}
                className="w-full p-4 text-left hover:bg-secondary/30 transition-colors touch-pan-y"
                style={{
                  transform: `translateX(${swipeX}px)`,
                  transition: draggingRef.current ? 'none' : 'transform 160ms ease-out',
                }}
                onPointerDown={onMatchPointerDown(match.id)}
                onPointerMove={onMatchPointerMove}
                onPointerUp={onMatchPointerEnd}
                onPointerCancel={onMatchPointerEnd}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${resultBg} ${resultColor}`}
                      >
                        {isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                      </span>
                      <span className="text-xs text-muted-foreground">{match.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{match.myTeamName}</span>
                      <span className="text-2xl font-black text-primary">{match.myTeamScore}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-2xl font-black text-accent">{match.opponentScore}</span>
                      <span className="font-semibold text-foreground">{match.opponentName}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </button>
              </div>

              {/*
                Delete button fallback (kept commented out).
                Swipe-left delete is the primary interaction.
              <div className="px-4 py-2 flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteMatch(match.id);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors p-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
              */}
            </div>
          );
        })}
      </div>
    </div>
  );
}
