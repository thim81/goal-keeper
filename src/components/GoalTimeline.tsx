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

  return (
    <div className="flex-1 overflow-y-auto px-1">
      <div className="space-y-2">
        {timelineItems.map((item, index) => {
          if (item.kind === 'event') {
            const event = item.data;
            const Icon = eventTypeIcons[event.type];

            return (
              <div
                key={event.id}
                className="animate-slide-up flex items-center gap-3 py-1 px-3 bg-secondary/50 rounded-xl group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="p-2 rounded-lg bg-muted-foreground/10">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="font-medium text-muted-foreground flex-1">
                  {event.label || eventTypeLabels[event.type]}
                </span>
                <span className="text-sm font-mono text-muted-foreground/60 bg-secondary px-2 py-1 rounded">
                  {event.time}
                </span>
                {editable && onDeleteEvent && (
                  <button
                    onClick={() => onDeleteEvent(event.id)}
                    className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-accent" />
                  </button>
                )}
              </div>
            );
          }

          const goal = item.data;
          const Icon = goalTypeIcons[goal.type];
          const isMyTeam = goal.team === 'my-team';
          const teamName = isMyTeam ? myTeamName : opponentName;

          return (
            <div
              key={goal.id}
              className={`animate-slide-up goal-gradient rounded-xl py-1 px-3 border border-border/30 group ${
                isMyTeam ? 'border-l-4 border-l-primary' : 'border-l-4 border-l-accent'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isMyTeam ? 'bg-primary/20' : 'bg-accent/20'}`}>
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
                    {/*<p className="text-xs text-muted-foreground/60 mt-1">{teamName}</p>*/}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                    {goal.time}
                  </span>
                  {editable && onDeleteGoal && (
                    <button
                      onClick={() => onDeleteGoal(goal.id)}
                      className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-accent" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
