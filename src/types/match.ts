export type GoalType = 'normal' | 'penalty' | 'own-goal' | 'head';

export type GameEventType = 'start' | 'pause' | 'resume' | 'half-time' | 'full-time' | 'period-end';

export interface Goal {
  id: string;
  team: 'my-team' | 'opponent';
  scorer?: string;
  assist?: string;
  type: GoalType;
  time: string; // HH:MM format
  timestamp: number; // for ordering
}

export interface GameEvent {
  id: string;
  type: GameEventType;
  label?: string; // e.g. "End of Period 1"
  time: string;
  timestamp: number;
}

export interface Match {
  id: string;
  myTeamName: string;
  opponentName: string;
  isHome: boolean;
  goals: Goal[];
  events: GameEvent[];
  startedAt: number;
  endedAt?: number;
  isActive: boolean;
}

export interface MatchSummary {
  id: string;
  myTeamName: string;
  opponentName: string;
  isHome: boolean;
  myTeamScore: number;
  opponentScore: number;
  date: string;
  endedAt: number;
}

export type Theme = 'light' | 'dark' | 'system';

export interface AppSettings {
  teamName: string;
  players: string[];
  periodsCount: number;
  periodDuration: number; // in minutes
  syncToken?: string;
  theme: Theme;
}

export const DEFAULT_SETTINGS: AppSettings = {
  teamName: 'My Team',
  players: [],
  periodsCount: 4,
  periodDuration: 20,
  syncToken: '',
  theme: 'system',
};
