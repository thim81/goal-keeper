import { useEffect, useRef, useState } from 'react';
import { Goal, GameEvent } from '@/types/match';
import {
  Trophy,
  Target,
  AlertCircle,
  CircleDot,
  Play,
  Pause,
  Clock,
  Flag,
  Trash2,
} from 'lucide-react';
interface GoalTimelineProps {
  goals: Goal[];
  events: GameEvent[];
  myTeamName: string;
  opponentName: string;
  editable?: boolean;
  onDeleteGoal?: (id: string) => void;
  onDeleteEvent?: (id: string) => void;
}

const goalTypeIcons = {
  normal: Trophy,
  head: CircleDot,
  penalty: Target,
  'own-goal': AlertCircle,
};

const goalTypeLabels = {
  normal: '',
  head: 'HEAD',
  penalty: 'PEN',
  'own-goal': 'OG',
};

const eventTypeIcons = {
  start: Play,
  pause: Pause,
  resume: Play,
  'half-time': Clock,
  'full-time': Flag,
  'period-end': Clock,
};

const eventTypeLabels = {
  start: 'Match Started',
  pause: 'Pause',
  resume: 'Resume',
  'half-time': 'Half Time',
  'full-time': 'Full Time',
  'period-end': 'Period End',
};

type TimelineItem = { kind: 'goal'; data: Goal } | { kind: 'event'; data: GameEvent };

export function GoalTimeline({
  goals,
  events,
  myTeamName,
  opponentName,
  editable = false,
  onDeleteGoal,
  onDeleteEvent,
}: GoalTimelineProps) {
  // Combine goals and events, then sort by timestamp
  const timelineItems: TimelineItem[] = [
    ...goals.map((g) => ({ kind: 'goal' as const, data: g })),
    ...events.map((e) => ({ kind: 'event' as const, data: e })),
  ].sort((a, b) => a.data.timestamp - b.data.timestamp);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(timelineItems.length);

  useEffect(() => {
    // Only auto-scroll when new items are added
    const prev = prevCountRef.current;
    const next = timelineItems.length;
    if (next > prev) {
      // Use rAF so layout is updated before we scroll
      requestAnimationFrame(() => {
        // Scroll the parent container (LiveMatchLayout handles scrolling)
        const el = scrollRef.current?.closest('.overflow-y-auto');
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
    }
    prevCountRef.current = next;
  }, [timelineItems.length]);

  // iOS-like swipe-to-delete for event rows
  const MAX_SWIPE_PX = 84; // width of the revealed action area
  const SWIPE_SNAP_THRESHOLD = 42;

  const [eventSwipeX, setEventSwipeX] = useState<Record<string, number>>({});
  const activeEventIdRef = useRef<string | null>(null);
  const startXRef = useRef(0);
  const startSwipeRef = useRef(0);
  const draggingRef = useRef(false);

  const closeAllEventSwipes = () => setEventSwipeX({});

  const onEventPointerDown = (eventId: string) => (e: React.PointerEvent) => {
    if (!editable || !onDeleteEvent) return;

    // Only handle horizontal swipes (pointer events work on iOS Safari and desktop)
    draggingRef.current = true;
    activeEventIdRef.current = eventId;
    startXRef.current = e.clientX;
    startSwipeRef.current = eventSwipeX[eventId] ?? 0;

    // Close other rows when starting a new swipe
    setEventSwipeX((prev) => {
      const next: Record<string, number> = {};
      if (prev[eventId]) next[eventId] = prev[eventId];
      return next;
    });

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onEventPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const eventId = activeEventIdRef.current;
    if (!eventId) return;

    const dx = e.clientX - startXRef.current;

    // We only allow swiping left to reveal (negative X). Clamp to [-MAX_SWIPE_PX, 0]
    const nextX = Math.max(-MAX_SWIPE_PX, Math.min(0, startSwipeRef.current + dx));

    setEventSwipeX((prev) => ({ ...prev, [eventId]: nextX }));
  };

  const onEventPointerEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    const eventId = activeEventIdRef.current;
    activeEventIdRef.current = null;
    if (!eventId) return;

    const currentX = eventSwipeX[eventId] ?? 0;
    const shouldReveal = Math.abs(currentX) >= SWIPE_SNAP_THRESHOLD;

    setEventSwipeX((prev) => ({ ...prev, [eventId]: shouldReveal ? -MAX_SWIPE_PX : 0 }));
  };

  const onEventRowClick = (eventId: string) => () => {
    // If user taps elsewhere while a row is open, close it.
    if ((eventSwipeX[eventId] ?? 0) !== 0) {
      setEventSwipeX((prev) => ({ ...prev, [eventId]: 0 }));
    }
  };

  const [goalSwipeX, setGoalSwipeX] = useState<Record<string, number>>({});
  const activeGoalIdRef = useRef<string | null>(null);
  const goalStartXRef = useRef(0);
  const goalStartSwipeRef = useRef(0);
  const goalDraggingRef = useRef(false);

  const closeAllGoalSwipes = () => setGoalSwipeX({});

  const onGoalPointerDown = (goalId: string) => (e: React.PointerEvent) => {
    if (!editable || !onDeleteGoal) return;

    goalDraggingRef.current = true;
    activeGoalIdRef.current = goalId;
    goalStartXRef.current = e.clientX;
    goalStartSwipeRef.current = goalSwipeX[goalId] ?? 0;

    // Close other goal rows when starting a new swipe
    setGoalSwipeX((prev) => {
      const next: Record<string, number> = {};
      if (prev[goalId]) next[goalId] = prev[goalId];
      return next;
    });

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onGoalPointerMove = (e: React.PointerEvent) => {
    if (!goalDraggingRef.current) return;
    const goalId = activeGoalIdRef.current;
    if (!goalId) return;

    const dx = e.clientX - goalStartXRef.current;
    const nextX = Math.max(-MAX_SWIPE_PX, Math.min(0, goalStartSwipeRef.current + dx));
    setGoalSwipeX((prev) => ({ ...prev, [goalId]: nextX }));
  };

  const onGoalPointerEnd = () => {
    if (!goalDraggingRef.current) return;
    goalDraggingRef.current = false;

    const goalId = activeGoalIdRef.current;
    activeGoalIdRef.current = null;
    if (!goalId) return;

    const currentX = goalSwipeX[goalId] ?? 0;
    const shouldReveal = Math.abs(currentX) >= SWIPE_SNAP_THRESHOLD;
    setGoalSwipeX((prev) => ({ ...prev, [goalId]: shouldReveal ? -MAX_SWIPE_PX : 0 }));
  };

  const onGoalRowClick = (goalId: string) => () => {
    if ((goalSwipeX[goalId] ?? 0) !== 0) {
      setGoalSwipeX((prev) => ({ ...prev, [goalId]: 0 }));
    }
  };

  if (timelineItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No goals yet</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Goals & events will appear here</p>
        </div>
      </div>
    );
  }

  if (!editable) {
    if (Object.keys(eventSwipeX).length > 0) closeAllEventSwipes();
    if (Object.keys(goalSwipeX).length > 0) closeAllGoalSwipes();
  }

  return (
    <div ref={scrollRef} className="space-y-2 pb-2">
      {timelineItems.map((item, index) => {
        if (item.kind === 'event') {
          const event = item.data;
          const Icon = eventTypeIcons[event.type];
          const swipeX = eventSwipeX[event.id] ?? 0;
          const canSwipeDelete = editable && !!onDeleteEvent;

          return (
            <div
              key={event.id}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Swipe container */}
              <div className="relative overflow-hidden rounded-xl">
                {/* Revealed action (right side) */}
                {canSwipeDelete && swipeX !== 0 && (
                  <button
                    onClick={() => onDeleteEvent(event.id)}
                    className="absolute inset-y-0 right-0 w-[84px] bg-accent text-accent-foreground flex items-center justify-center"
                    aria-label="Delete event"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}

                {/* Foreground row (slides left) */}
                <div
                  className="flex items-center gap-2 py-1 px-3 bg-secondary group touch-pan-y"
                  style={{
                    transform: `translateX(${canSwipeDelete ? swipeX : 0}px)`,
                    transition: draggingRef.current ? 'none' : 'transform 160ms ease-out',
                  }}
                  onPointerDown={canSwipeDelete ? onEventPointerDown(event.id) : undefined}
                  onPointerMove={canSwipeDelete ? onEventPointerMove : undefined}
                  onPointerUp={canSwipeDelete ? onEventPointerEnd : undefined}
                  onPointerCancel={canSwipeDelete ? onEventPointerEnd : undefined}
                  onClick={canSwipeDelete ? onEventRowClick(event.id) : undefined}
                >
                  <div className="p-2 rounded-lg bg-muted-foreground/10">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>

                  <span className="font-medium text-muted-foreground flex-1 min-w-0 truncate">
                    {event.label || eventTypeLabels[event.type]}
                  </span>

                  <span className="text-sm font-mono text-muted-foreground/60 bg-secondary px-2 py-1 rounded shrink-0">
                    {event.time}
                  </span>

                  {/* Keep existing explicit delete button too (desktop friendly). Hide it while swipe actions exist. */}
                  {editable && onDeleteEvent && !canSwipeDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEvent(event.id);
                      }}
                      className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent/20 transition-all"
                      aria-label="Delete event"
                    >
                      <Trash2 className="w-4 h-4 text-accent" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }

        const goal = item.data;
        const Icon = goalTypeIcons[goal.type];
        const isMyTeam = goal.team === 'my-team';
        const teamName = isMyTeam ? myTeamName : opponentName;

        const swipeX = goalSwipeX[goal.id] ?? 0;
        const canSwipeDelete = editable && !!onDeleteGoal;

        return (
          <div
            key={goal.id}
            className="animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="relative overflow-hidden rounded-xl">
              {/* Revealed action (right side) */}
              {canSwipeDelete && swipeX !== 0 && (
                <button
                  onClick={() => onDeleteGoal(goal.id)}
                  className="absolute inset-y-0 right-0 w-[84px] bg-accent text-accent-foreground flex items-center justify-center"
                  aria-label="Delete goal"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              {/* Foreground row (slides left) */}
              <div
                className={`${swipeX !== 0 ? 'bg-secondary' : 'goal-gradient'} rounded-xl py-1 px-3 border border-border/30 group touch-pan-y ${
                  isMyTeam ? 'border-l-4 border-l-primary' : 'border-l-4 border-l-accent'
                }`}
                style={{
                  transform: `translateX(${canSwipeDelete ? swipeX : 0}px)`,
                  transition: goalDraggingRef.current ? 'none' : 'transform 160ms ease-out',
                  backgroundClip: 'padding-box',
                }}
                onPointerDown={canSwipeDelete ? onGoalPointerDown(goal.id) : undefined}
                onPointerMove={canSwipeDelete ? onGoalPointerMove : undefined}
                onPointerUp={canSwipeDelete ? onGoalPointerEnd : undefined}
                onPointerCancel={canSwipeDelete ? onGoalPointerEnd : undefined}
                onClick={canSwipeDelete ? onGoalRowClick(goal.id) : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${isMyTeam ? 'bg-primary/20' : 'bg-accent/20'}`}
                    >
                      <Icon className={`w-4 h-4 ${isMyTeam ? 'text-primary' : 'text-accent'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{goal.scorer || teamName}</span>
                        {goalTypeLabels[goal.type] && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              goal.type === 'own-goal'
                                ? 'bg-accent/20 text-accent'
                                : 'bg-goal/20 text-goal'
                            }`}
                          >
                            {goalTypeLabels[goal.type]}
                          </span>
                        )}
                      </div>
                      {goal.assist && (
                        <p className="text-sm text-muted-foreground">Assist: {goal.assist}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                      {goal.time}
                    </span>

                    {/* Desktop fallback delete button (only if swipe is not available) */}
                    {editable && onDeleteGoal && !canSwipeDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGoal(goal.id);
                        }}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent/20 transition-all"
                        aria-label="Delete goal"
                      >
                        <Trash2 className="w-4 h-4 text-accent" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
