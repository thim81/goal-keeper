import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { CalendarRange, History, RotateCcw, Settings } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlayerAutocomplete } from '@/components/PlayerAutocomplete';
import { createDefaultSeasonName } from '@/lib/seasons';
import { GoalType, GameEventType, Match } from '@/types/match';

type View = 'home' | 'live' | 'history' | 'detail' | 'settings';

export default function Index() {
  const [view, setView] = useState<View>('home');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddOpponentGoal, setShowAddOpponentGoal] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showStartMatch, setShowStartMatch] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedMatchSeasonId, setSelectedMatchSeasonId] = useState<string | null>(null);
  const [showSecondaryActions, setShowSecondaryActions] = useState(false);
  const [pendingDeleteMatch, setPendingDeleteMatch] = useState<{
    matchId: string;
    seasonId: string;
  } | null>(null);
  const [pendingReopenSeasonId, setPendingReopenSeasonId] = useState<string | null>(null);
  const [showRenameOpponent, setShowRenameOpponent] = useState(false);
  const [opponentNameDraft, setOpponentNameDraft] = useState('');
  const [showCloseSeason, setShowCloseSeason] = useState(false);
  const [nextSeasonName, setNextSeasonName] = useState('');
  const [showRenameSeason, setShowRenameSeason] = useState(false);
  const [seasonNameDraft, setSeasonNameDraft] = useState('');
  const [selectedHistorySeasonId, setSelectedHistorySeasonId] = useState<string | null>(null);
  const [syncScrollSignal, setSyncScrollSignal] = useState(0);
  const dragStartY = useRef(0);
  const dragging = useRef(false);
  const seasonLongPressTimerRef = useRef<number | null>(null);
  const seasonLongPressTriggeredRef = useRef(false);

  const {
    activeMatch,
    activeSeasonId,
    seasons,
    matchHistory,
    startMatch,
    addGoal,
    deleteGoal,
    addEvent,
    deleteEvent,
    undoLast,
    endMatch,
    deleteMatch,
    renameHistoricalOpponent,
    getScore,
    getSeasonSummaries,
    getSeasonStatsById,
    getSeasonMatchHistory,
    getSeasonMatchDetails,
    startPeriod,
    endPeriod,
    toggleTimer,
    setAllMatchesState,
    renameOpponent,
    closeAndStartNewSeason,
    canCloseSeason,
    canReopenSeason,
    reopenSeason,
    renameSeasonName,
  } = useMatches();

  const {
    settings,
    updateTeamName,
    addPlayer,
    removePlayer,
    updatePeriods,
    updateSyncToken,
    updateTheme,
    updateDebug,
    setAllSettingsState,
  } = useSettings();

  useTheme(settings.theme);

  const handleToggleSecondary = (open: boolean) => {
    setShowSecondaryActions(open);
  };

  const handleOpenRenameOpponent = () => {
    if (!activeMatch) return;
    setOpponentNameDraft(activeMatch.opponentName);
    setShowRenameOpponent(true);
  };

  const handleSaveRenameOpponent = () => {
    const trimmed = opponentNameDraft.trim();
    if (!trimmed) return;
    renameOpponent(trimmed);
    setShowRenameOpponent(false);
  };

  const handleSyncState = useCallback(
    (state: SyncState) => {
      setAllMatchesState(state);
      setAllSettingsState(state.settings);
      if (state.activeMatch) {
        setSyncScrollSignal((value) => value + 1);
      }
    },
    [setAllMatchesState, setAllSettingsState],
  );

  useSync(settings.syncToken, seasons, activeSeasonId, activeMatch, settings, handleSyncState);

  const seasonSummaries = useMemo(() => getSeasonSummaries(), [getSeasonSummaries]);

  useEffect(() => {
    if (!activeSeasonId) return;
    if (!selectedHistorySeasonId) {
      setSelectedHistorySeasonId(activeSeasonId);
      return;
    }
    const exists = seasonSummaries.some((season) => season.id === selectedHistorySeasonId);
    if (!exists) {
      setSelectedHistorySeasonId(activeSeasonId);
    }
  }, [activeSeasonId, selectedHistorySeasonId, seasonSummaries]);

  useEffect(
    () => () => {
      if (seasonLongPressTimerRef.current) {
        window.clearTimeout(seasonLongPressTimerRef.current);
      }
    },
    [],
  );

  const opponentSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const suggestions: string[] = [];

    for (const match of matchHistory) {
      const trimmed = match.opponentName.trim();
      if (!trimmed) continue;
      const key = trimmed.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(trimmed);
    }

    return suggestions;
  }, [matchHistory]);

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
  const handleAddEvent = (
    type: GameEventType,
    options?: { team?: 'my-team' | 'opponent'; player?: string },
  ) => {
    if (type === 'start') {
      startPeriod();
    } else if (type === 'period-end') {
      endPeriod();
    } else if (type === 'pause' || type === 'resume') {
      toggleTimer();
    } else {
      const label =
        type === 'yellow-card' || type === 'red-card'
          ? [
              options?.team
                ? options.team === 'my-team'
                  ? (activeMatch?.myTeamName ?? 'My Team')
                  : (activeMatch?.opponentName ?? 'Opponent')
                : undefined,
              options?.player,
            ]
              .filter(Boolean)
              .join(' • ') || undefined
          : undefined;

      addEvent(type, label, options);

      if (type === 'yellow-card' || type === 'red-card') {
        if (options?.team === 'my-team' && options.player) {
          addPlayer(options.player);
        }
      }
    }
  };

  // Handle ending match
  const handleEndMatch = () => {
    endPeriod();
    endMatch();
    setView('home');
  };

  const effectiveHistorySeasonId = selectedHistorySeasonId ?? activeSeasonId;
  const historyMatches = effectiveHistorySeasonId
    ? getSeasonMatchHistory(effectiveHistorySeasonId)
    : [];

  // Handle viewing match details
  const handleSelectMatch = (matchId: string) => {
    if (!effectiveHistorySeasonId) return;
    const match = getSeasonMatchDetails(effectiveHistorySeasonId, matchId);
    if (match) {
      setSelectedMatch(match);
      setSelectedMatchSeasonId(effectiveHistorySeasonId);
      setView('detail');
    }
  };

  const pendingDeleteMatchSummary = pendingDeleteMatch
    ? (getSeasonMatchHistory(pendingDeleteMatch.seasonId).find(
        (match) => match.id === pendingDeleteMatch.matchId,
      ) ?? null)
    : null;

  const handleRequestDeleteMatch = (matchId: string) => {
    if (!effectiveHistorySeasonId) return;
    setPendingDeleteMatch({ matchId, seasonId: effectiveHistorySeasonId });
  };

  const handleConfirmDeleteMatch = () => {
    if (!pendingDeleteMatch) return;
    deleteMatch(pendingDeleteMatch.matchId, pendingDeleteMatch.seasonId);
    setPendingDeleteMatch(null);
  };

  const handleOpenCloseSeason = () => {
    setNextSeasonName(createDefaultSeasonName());
    setShowCloseSeason(true);
  };

  const handleConfirmCloseSeason = () => {
    const success = closeAndStartNewSeason({ name: nextSeasonName });
    if (!success) return;
    setShowCloseSeason(false);
    setView('home');
  };

  const handleConfirmReopenSeason = () => {
    if (!pendingReopenSeasonId) return;
    const ok = reopenSeason(pendingReopenSeasonId);
    if (ok) {
      setSelectedHistorySeasonId(pendingReopenSeasonId);
    }
    setPendingReopenSeasonId(null);
  };

  const startSeasonNameLongPress = () => {
    if (!selectedSeasonSummary) return;
    seasonLongPressTriggeredRef.current = false;
    if (seasonLongPressTimerRef.current) {
      window.clearTimeout(seasonLongPressTimerRef.current);
    }
    seasonLongPressTimerRef.current = window.setTimeout(() => {
      seasonLongPressTriggeredRef.current = true;
      setSeasonNameDraft(selectedSeasonSummary.name);
      setShowRenameSeason(true);
    }, 500);
  };

  const cancelSeasonNameLongPress = () => {
    if (!seasonLongPressTimerRef.current) return;
    window.clearTimeout(seasonLongPressTimerRef.current);
    seasonLongPressTimerRef.current = null;
  };

  const handleSeasonNameClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!seasonLongPressTriggeredRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    seasonLongPressTriggeredRef.current = false;
  };

  const handleSaveSeasonName = () => {
    if (!selectedSeasonSummary) return;
    const ok = renameSeasonName(selectedSeasonSummary.id, seasonNameDraft);
    if (!ok) return;
    setShowRenameSeason(false);
  };

  const activeSeasonStats = activeSeasonId ? getSeasonStatsById(activeSeasonId) : null;
  const activeSeasonMatchCount = activeSeasonStats?.matches ?? 0;
  const activeSeasonTopScorer = activeSeasonStats?.topScorer;

  const selectedSeasonSummary = seasonSummaries.find(
    (season) => season.id === effectiveHistorySeasonId,
  );
  const selectedSeasonLabel = selectedSeasonSummary
    ? `${selectedSeasonSummary.name}${selectedSeasonSummary.status === 'active' ? ' (Active)' : ''}`
    : '';

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
          onUpdateDebug={updateDebug}
        />
      )}

      {/* Match Detail View */}
      {view === 'detail' && selectedMatch && (
        <MatchDetail
          match={selectedMatch}
          opponentSuggestions={opponentSuggestions}
          onRenameOpponent={(name) => {
            const updated = renameHistoricalOpponent(
              selectedMatch.id,
              name,
              selectedMatchSeasonId ?? undefined,
            );
            if (updated) setSelectedMatch(updated);
          }}
          onBack={() => {
            setSelectedMatch(null);
            setSelectedMatchSeasonId(null);
            setView('history');
          }}
        />
      )}

      {/* History View */}
      {view === 'history' && (
        <div className="min-h-screen flex flex-col safe-top overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div>
              <h1 className="text-xl font-bold text-foreground">Match History</h1>
              {selectedSeasonLabel ? (
                <button
                  type="button"
                  className="mt-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Long press to rename season"
                  onPointerDown={startSeasonNameLongPress}
                  onPointerUp={cancelSeasonNameLongPress}
                  onPointerLeave={cancelSeasonNameLongPress}
                  onPointerCancel={cancelSeasonNameLongPress}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={handleSeasonNameClick}
                >
                  {selectedSeasonLabel}
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              {selectedSeasonSummary?.status === 'closed' && (
                <button
                  onClick={() => setPendingReopenSeasonId(selectedSeasonSummary.id)}
                  disabled={!canReopenSeason}
                  className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reopen this season"
                >
                  <RotateCcw className="w-5 h-5 text-foreground" />
                </button>
              )}
              <button
                onClick={handleOpenCloseSeason}
                className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                title="Close season and start new"
              >
                <CalendarRange className="w-5 h-5 text-foreground" />
              </button>
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
            {seasonSummaries.length > 0 && (
              <div className="mb-3">
                <label className="text-xs text-muted-foreground mb-1.5 block">Season</label>
                <select
                  value={effectiveHistorySeasonId ?? ''}
                  onChange={(e) => setSelectedHistorySeasonId(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {seasonSummaries.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                      {season.status === 'active' ? ' (Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <MatchHistory
              matches={historyMatches}
              onSelectMatch={handleSelectMatch}
              onDeleteMatch={handleRequestDeleteMatch}
            />
          </div>
        </div>
      )}

      {/* Live Match View */}
      {view === 'live' && activeMatch && (
        <LiveMatchLayout
          debug={settings.debug}
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
                onOpponentLongPress={handleOpenRenameOpponent}
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
                scrollToBottomSignal={syncScrollSignal}
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
            myTeamName={activeMatch.myTeamName}
            opponentName={activeMatch.opponentName}
            knownPlayers={settings.players}
          />
        </LiveMatchLayout>
      )}

      {/* Home View */}
      {view === 'home' && !activeMatch && (
        <div className="min-h-screen flex flex-col safe-top">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-2xl font-black text-foreground">⚽️ Goal Keeper</h1>
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

            {activeSeasonMatchCount > 0 && (
              <button
                onClick={() => setView('history')}
                className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View {activeSeasonMatchCount} past match{activeSeasonMatchCount !== 1 ? 'es' : ''}
              </button>
            )}
          </div>

          {/* Start Match Sheet */}
          <StartMatchSheet
            isOpen={showStartMatch}
            onClose={() => setShowStartMatch(false)}
            onStartMatch={handleStartMatch}
            defaultTeamName={settings.teamName}
            opponentSuggestions={opponentSuggestions}
          />
        </div>
      )}

      <AlertDialog
        open={!!pendingDeleteMatch}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteMatch(null);
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete match?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteMatchSummary
                ? `This will permanently remove ${pendingDeleteMatchSummary.myTeamName} vs ${pendingDeleteMatchSummary.opponentName} (${pendingDeleteMatchSummary.date}) from your history.`
                : 'This will permanently remove the selected match from your history.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteMatch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingReopenSeasonId}
        onOpenChange={(open) => {
          if (!open) setPendingReopenSeasonId(null);
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this season?</AlertDialogTitle>
            <AlertDialogDescription>
              This will close the currently active season and mark the selected season as active.
            </AlertDialogDescription>
            {!canReopenSeason && (
              <p className="text-xs text-destructive">
                Finish the active match before reopening a season.
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReopenSeason} disabled={!canReopenSeason}>
              Reopen Season
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={showCloseSeason}
        onOpenChange={(open) => {
          setShowCloseSeason(open);
          if (!open) {
            setNextSeasonName(createDefaultSeasonName());
          }
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Close Season</DialogTitle>
            <DialogDescription>
              Archive this season and start a new one with fresh match history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-xl border border-border/50 bg-secondary/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Matches</span>
              <span className="font-semibold text-foreground">
                {activeSeasonStats?.matches ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">W / D / L</span>
              <span className="font-semibold text-foreground">
                {activeSeasonStats?.wins ?? 0} / {activeSeasonStats?.draws ?? 0} /{' '}
                {activeSeasonStats?.losses ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Goals (For-Against)</span>
              <span className="font-semibold text-foreground">
                {activeSeasonStats?.goalsFor ?? 0}-{activeSeasonStats?.goalsAgainst ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Top scorer</span>
              <span className="font-semibold text-foreground">{activeSeasonTopScorer ?? '—'}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">New season name</label>
            <PlayerAutocomplete
              value={nextSeasonName}
              onChange={setNextSeasonName}
              players={[]}
              placeholder="Season name"
              autoFocus
            />
          </div>

          {!canCloseSeason && (
            <p className="text-xs text-destructive">
              Finish the active match before closing the season.
            </p>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCloseSeason(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCloseSeason}
              disabled={!canCloseSeason || !nextSeasonName.trim()}
            >
              Close & Start New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRenameSeason}
        onOpenChange={(open) => {
          setShowRenameSeason(open);
          if (!open && selectedSeasonSummary) {
            setSeasonNameDraft(selectedSeasonSummary.name);
          }
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Rename Season</DialogTitle>
            <DialogDescription>Long-pressing the season name opens this dialog.</DialogDescription>
          </DialogHeader>
          <PlayerAutocomplete
            value={seasonNameDraft}
            onChange={setSeasonNameDraft}
            players={[]}
            placeholder="Season name"
            autoFocus
            maxLength={80}
            onEnter={handleSaveSeasonName}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowRenameSeason(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSeasonName} disabled={!seasonNameDraft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRenameOpponent}
        onOpenChange={(open) => {
          setShowRenameOpponent(open);
          if (!open && activeMatch) {
            setOpponentNameDraft(activeMatch.opponentName);
          }
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Opponent Name</DialogTitle>
            <DialogDescription>
              Long-pressing the opponent team name opens this dialog.
            </DialogDescription>
          </DialogHeader>
          <PlayerAutocomplete
            value={opponentNameDraft}
            onChange={setOpponentNameDraft}
            players={opponentSuggestions}
            placeholder="Opponent name"
            autoFocus
            maxLength={60}
            onEnter={handleSaveRenameOpponent}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowRenameOpponent(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRenameOpponent} disabled={!opponentNameDraft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
