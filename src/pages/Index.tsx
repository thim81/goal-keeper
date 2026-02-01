import { useState, useCallback, useRef } from 'react';
import { History, Settings } from 'lucide-react';
import { useMatches } from '@/hooks/useMatches';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useSync } from '@/hooks/useSync';
import { SyncState } from '@/lib/sync';
import { Scoreboard } from '@/components/Scoreboard';
import { GoalTimeline } from '@/components/GoalTimeline';
import { MatchTimer } from '@/components/MatchTimer';
import { MatchActions } from '@/components/MatchActions';
import { LiveMatchLayout } from '@/components/LiveMatchLayout';
import { AddGoalSheet } from '@/components/AddGoalSheet';
import { AddOpponentGoalSheet } from '@/components/AddOpponentGoalSheet';
import { AddEventSheet } from '@/components/AddEventSheet';
import { StartMatchSheet } from '@/components/StartMatchSheet';
import { MatchHistory } from '@/components/MatchHistory';
import { MatchDetail } from '@/components/MatchDetail';
import { SettingsScreen } from '@/components/SettingsScreen';
import { GoalType, GameEventType, Match } from '@/types/match';

type View = 'home' | 'live' | 'history' | 'detail' | 'settings';

export default function Index() {
  const [view, setView] = useState<View>('home');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddOpponentGoal, setShowAddOpponentGoal] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showStartMatch, setShowStartMatch] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showSecondaryActions, setShowSecondaryActions] = useState(false);
  const dragStartY = useRef(0);
  const dragging = useRef(false);

  const {
    activeMatch,
    matchHistory,
    startMatch,
    addGoal,
    deleteGoal,
    addEvent,
    deleteEvent,
    undoLast,
    endMatch,
    getMatchDetails,
    deleteMatch,
    getScore,
    startPeriod,
    endPeriod,
    toggleTimer,
    setAllMatchesState,
  } = useMatches();

  const {
    settings,
    updateTeamName,
    addPlayer,
    removePlayer,
    updatePeriods,
    updateSyncToken,
    updateTheme,
    setAllSettingsState,
  } = useSettings();

  useTheme(settings.theme);

  const handleToggleSecondary = (open: boolean) => {
    setShowSecondaryActions(open);
  };

  const handleSyncState = useCallback(
    (state: SyncState) => {
      setAllMatchesState(state.matches, state.activeMatch, state.fullMatches);
      setAllSettingsState(state.settings);
    },
    [setAllMatchesState, setAllSettingsState],
  );

  useSync(settings.syncToken, matchHistory, activeMatch, settings, handleSyncState);

  const score = getScore();
  const isPeriodEnded = activeMatch?.events?.at(-1)?.type === 'period-end';

  // Handle starting a new match
  const handleStartMatch = (myTeamName: string, opponentName: string, isHome: boolean) => {
    startMatch(myTeamName, opponentName, isHome);
    setView('live');
  };

  // Handle adding a goal for my team
  const handleAddMyGoal = (scorer: string, assist: string, type: GoalType) => {
    addGoal('my-team', scorer, assist, type);
    // Auto-add scorer/assist to players list
    if (scorer) addPlayer(scorer);
    if (assist) addPlayer(assist);
  };

  // Handle adding opponent goal
  const handleAddOpponentGoal = (type: GoalType) => {
    addGoal('opponent', undefined, undefined, type);
  };

  // Handle adding an event
  const handleAddEvent = (type: GameEventType) => {
    if (type === 'start') {
      startPeriod();
    } else if (type === 'period-end') {
      endPeriod();
    } else if (type === 'pause' || type === 'resume') {
      toggleTimer();
    } else {
      addEvent(type);
    }
  };

  // Handle ending match
  const handleEndMatch = () => {
    endPeriod();
    endMatch();
    setView('home');
  };

  // Handle viewing match details
  const handleSelectMatch = (matchId: string) => {
    const match = getMatchDetails(matchId);
    if (match) {
      setSelectedMatch(match);
      setView('detail');
    }
  };

  // If there's an active match and we're on home, show live
  if (activeMatch && view === 'home') {
    setView('live');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Settings View */}
      {view === 'settings' && (
        <SettingsScreen
          settings={settings}
          onBack={() => setView(activeMatch ? 'live' : 'home')}
          onUpdateTeamName={updateTeamName}
          onAddPlayer={addPlayer}
          onRemovePlayer={removePlayer}
          onUpdatePeriods={updatePeriods}
          onUpdateSyncToken={updateSyncToken}
          onUpdateTheme={updateTheme}
        />
      )}

      {/* Match Detail View */}
      {view === 'detail' && selectedMatch && (
        <MatchDetail
          match={selectedMatch}
          onBack={() => {
            setSelectedMatch(null);
            setView('history');
          }}
        />
      )}

      {/* History View */}
      {view === 'history' && (
        <div className="min-h-screen flex flex-col safe-top overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <h1 className="text-xl font-bold text-foreground">Match History</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setView('settings')}
                className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <Settings className="w-5 h-5 text-foreground" />
              </button>
              <button
                onClick={() => setView(activeMatch ? 'live' : 'home')}
                className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                {activeMatch ? 'Back to Match' : 'Home'}
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col overflow-hidden">
            <MatchHistory
              matches={matchHistory}
              onSelectMatch={handleSelectMatch}
              onDeleteMatch={deleteMatch}
            />
          </div>
        </div>
      )}

      {/* Live Match View */}
      {view === 'live' && activeMatch && (
        <LiveMatchLayout
          header={
            <div className="flex items-center justify-between p-4">
              <h1 className="text-lg font-bold text-foreground">⚽ Goal Keeper</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setView('settings')}
                  className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <Settings className="w-5 h-5 text-foreground" />
                </button>
                <button
                  onClick={() => setView('history')}
                  className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <History className="w-5 h-5 text-foreground" />
                </button>
              </div>
            </div>
          }
          top={
            <div className="px-4">
              <Scoreboard
                match={activeMatch}
                myTeamScore={score.myTeam}
                opponentScore={score.opponent}
              />
              <MatchTimer
                startedAt={activeMatch.startedAt}
                periodsCount={settings.periodsCount}
                periodDuration={settings.periodDuration}
                isRunning={activeMatch.isRunning}
                totalPausedTime={activeMatch.totalPausedTime}
                pausedAt={activeMatch.pausedAt}
                currentPeriod={activeMatch.currentPeriod}
              />
            </div>
          }
          timeline={
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Timeline
              </h2>
              <GoalTimeline
                goals={activeMatch.goals}
                events={activeMatch.events}
                myTeamName={activeMatch.myTeamName}
                opponentName={activeMatch.opponentName}
                editable
                onDeleteGoal={deleteGoal}
                onDeleteEvent={deleteEvent}
              />
            </>
          }
          actionsHandle={
            <button
              type="button"
              aria-label={showSecondaryActions ? 'Hide extra actions' : 'Show extra actions'}
              className="w-full flex justify-center pb-2"
              onClick={() => handleToggleSecondary(!showSecondaryActions)}
              onPointerDown={(e) => {
                dragging.current = true;
                dragStartY.current = e.clientY;
                try {
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
              }}
              onPointerMove={(e) => {
                if (!dragging.current) return;
                const deltaY = e.clientY - dragStartY.current;
                if (deltaY < -12) handleToggleSecondary(true);
                if (deltaY > 12) handleToggleSecondary(false);
              }}
              onPointerUp={() => {
                if (!dragging.current) return;
                dragging.current = false;
              }}
              onPointerCancel={() => {
                if (!dragging.current) return;
                dragging.current = false;
              }}
            >
              <span className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </button>
          }
          actions={
            <MatchActions
              onAddMyGoal={() => setShowAddGoal(true)}
              onAddOpponentGoal={() => setShowAddOpponentGoal(true)}
              onAddEvent={() => setShowAddEvent(true)}
              onUndo={undoLast}
              onEndMatch={handleEndMatch}
              onStartPeriod={startPeriod}
              onEndPeriod={endPeriod}
              onToggleTimer={toggleTimer}
              isRunning={activeMatch.isRunning}
              canUndo={activeMatch.goals.length > 0 || activeMatch.events.length > 0}
              currentPeriod={activeMatch.currentPeriod}
              isPeriodEnded={!!isPeriodEnded}
              isHome={activeMatch.isHome}
              showSecondaryActions={showSecondaryActions}
            />
          }
        >
          {/* Add Goal Sheet */}
          <AddGoalSheet
            isOpen={showAddGoal}
            onClose={() => setShowAddGoal(false)}
            onAddGoal={handleAddMyGoal}
            knownPlayers={settings.players}
          />

          {/* Add Opponent Goal Sheet */}
          <AddOpponentGoalSheet
            isOpen={showAddOpponentGoal}
            onClose={() => setShowAddOpponentGoal(false)}
            onAddGoal={handleAddOpponentGoal}
            opponentName={activeMatch.opponentName}
          />

          {/* Add Event Sheet */}
          <AddEventSheet
            isOpen={showAddEvent}
            onClose={() => setShowAddEvent(false)}
            onAddEvent={handleAddEvent}
          />
        </LiveMatchLayout>
      )}

      {/* Home View */}
      {view === 'home' && !activeMatch && (
        <div className="min-h-screen flex flex-col safe-top">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-2xl font-black text-foreground">Goal Keeper</h1>
              <p className="text-sm text-muted-foreground">Track your football matches</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('settings')}
                className="p-3 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <Settings className="w-5 h-5 text-foreground" />
              </button>
              <button
                onClick={() => setView('history')}
                className="p-3 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <History className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-5xl">⚽</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Ready to Play?</h2>
              <p className="text-muted-foreground">Start tracking your match goals in real time</p>
            </div>

            <button
              onClick={() => setShowStartMatch(true)}
              className="w-full max-w-xs py-5 bg-primary text-primary-foreground font-bold text-xl rounded-2xl hover:bg-primary/90 transition-all active:scale-[0.98] btn-glow"
            >
              Start New Match
            </button>

            {matchHistory.length > 0 && (
              <button
                onClick={() => setView('history')}
                className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View {matchHistory.length} past match{matchHistory.length !== 1 ? 'es' : ''}
              </button>
            )}
          </div>

          {/* Start Match Sheet */}
          <StartMatchSheet
            isOpen={showStartMatch}
            onClose={() => setShowStartMatch(false)}
            onStartMatch={handleStartMatch}
            defaultTeamName={settings.teamName}
          />
        </div>
      )}
    </div>
  );
}
