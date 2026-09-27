import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { CalendarRange, History, RefreshCw, RotateCcw, Settings } from "lucide-react";
import { useMatches } from "@/hooks/useMatches";
import { useSettings } from "@/hooks/useSettings";
import { useTheme } from "@/hooks/useTheme";
import { useSync } from "@/hooks/useSync";
import { SyncState } from "@/lib/sync";
import { Scoreboard } from "@/components/Scoreboard";
import { GoalTimeline } from "@/components/GoalTimeline";
import { MatchTimer } from "@/components/MatchTimer";
import { MatchActions } from "@/components/MatchActions";
import { LiveMatchLayout } from "@/components/LiveMatchLayout";
import { AddGoalSheet } from "@/components/AddGoalSheet";
import { AddOpponentGoalSheet } from "@/components/AddOpponentGoalSheet";
import { AddEventSheet } from "@/components/AddEventSheet";
import { StartMatchSheet } from "@/components/StartMatchSheet";
import { MatchHistory } from "@/components/MatchHistory";
import { MatchResultCard } from "@/components/MatchResultCard";
import { UpcomingMatches } from "@/components/UpcomingMatches";
import { MatchDetail } from "@/components/MatchDetail";
import { SettingsScreen } from "@/components/SettingsScreen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerAutocomplete } from "@/components/PlayerAutocomplete";
import { createDefaultSeasonName } from "@/lib/seasons";
import { buildBackupPayload, parseBackupPayload } from "@/lib/backup";
import { getRecentMatchWithinDays } from "@/lib/recent-match";
import { useUpcomingMatches } from "@/hooks/useUpcomingMatches";
import type { UpcomingMatch } from "@/lib/upcoming-matches";
import {
  clearViewerTokenFromUrl,
  createViewerLink,
  getViewerTokenFromUrl,
  validateViewerLink,
} from "@/lib/share";
import { GoalType, GoalEdit, GameEventType, Match } from "@/types/match";
import { toast } from "sonner";

type View = "home" | "live" | "history" | "detail" | "settings";
type MatchDetailOrigin = "home" | "history";

export default function Index() {
  const [view, setView] = useState<View>("home");
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddOpponentGoal, setShowAddOpponentGoal] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showStartMatch, setShowStartMatch] = useState(false);
  const [scheduledMatchDefaults, setScheduledMatchDefaults] = useState<{
    opponentName: string;
    isHome: boolean;
  } | null>(null);
  const [showEndMatchPrompt, setShowEndMatchPrompt] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedMatchSeasonId, setSelectedMatchSeasonId] = useState<string | null>(null);
  const [matchDetailOrigin, setMatchDetailOrigin] = useState<MatchDetailOrigin>("history");
  const [showSecondaryActions, setShowSecondaryActions] = useState(false);
  const [pendingDeleteMatch, setPendingDeleteMatch] = useState<{
    matchId: string;
    seasonId: string;
  } | null>(null);
  const [pendingReopenSeasonId, setPendingReopenSeasonId] = useState<string | null>(null);
  const [showRenameOpponent, setShowRenameOpponent] = useState(false);
  const [opponentNameDraft, setOpponentNameDraft] = useState("");
  const [showCloseSeason, setShowCloseSeason] = useState(false);
  const [nextSeasonName, setNextSeasonName] = useState("");
  const [showRenameSeason, setShowRenameSeason] = useState(false);
  const [seasonNameDraft, setSeasonNameDraft] = useState("");
  const [viewerLink, setViewerLink] = useState("");
  const [sharedToken, setSharedToken] = useState(() =>
    typeof window === "undefined" ? "" : (getViewerTokenFromUrl(window.location.href) ?? ""),
  );
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
    updateGoal,
    addEvent,
    deleteEvent,
    updateEventTime,
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
    updateCalendarSettings,
    addPlayer,
    removePlayer,
    updatePeriods,
    updateSyncToken,
    updateTheme,
    updateDebug,
    setAllSettingsState,
  } = useSettings();
  const settingsTokenRef = useRef(settings.syncToken);
  settingsTokenRef.current = settings.syncToken;
  const shareRequestRef = useRef(0);

  const handleSyncState = useCallback(
    (state: SyncState) => {
      setAllMatchesState(state);
      setAllSettingsState({
        ...state.settings,
        calendarUrl:
          typeof state.settings.calendarUrl === "string"
            ? state.settings.calendarUrl
            : settings.calendarUrl,
        calendarTeamName:
          typeof state.settings.calendarTeamName === "string"
            ? state.settings.calendarTeamName
            : settings.calendarTeamName,
        theme: settings.theme,
        syncToken: settings.syncToken,
        debug: typeof state.settings.debug === "boolean" ? state.settings.debug : settings.debug,
      });
      if (state.activeMatch) setSyncScrollSignal((value) => value + 1);
    },
    [
      setAllMatchesState,
      setAllSettingsState,
      settings.calendarTeamName,
      settings.calendarUrl,
      settings.theme,
      settings.syncToken,
      settings.debug,
    ],
  );

  useTheme(settings.theme);

  const {
    status: syncStatus,
    role: workspaceRole,
    lastSyncedAt,
    syncNow,
    isSyncing,
    isCoolingDown,
  } = useSync(
    sharedToken ? undefined : settings.syncToken,
    seasons,
    activeSeasonId,
    activeMatch,
    settings,
    handleSyncState,
  );
  const canEdit =
    !sharedToken &&
    (workspaceRole === "editor" || (syncStatus === "local" && !settings.syncToken));

  const loadViewerLink = useCallback(async () => {
    if (!settings.syncToken || workspaceRole !== "editor") return "";
    const token = settings.syncToken;
    const requestId = ++shareRequestRef.current;
    try {
      const response = await fetch("/api/share", { headers: { "x-auth-token": token } });
      if (!response.ok) throw new Error("Sharing is unavailable");
      const { viewerToken } = (await response.json()) as { viewerToken: string };
      if (settingsTokenRef.current !== token || requestId !== shareRequestRef.current) return "";
      const link = createViewerLink(window.location.origin, viewerToken);
      setViewerLink(link);
      return link;
    } catch {
      if (settingsTokenRef.current !== token || requestId !== shareRequestRef.current) return "";
      setViewerLink("");
      toast.error("Could not load view-only link");
      return "";
    }
  }, [settings.syncToken, workspaceRole]);

  useEffect(() => {
    shareRequestRef.current += 1;
    setViewerLink("");
  }, [settings.syncToken]);

  useEffect(() => {
    if (!sharedToken) return;
    let cancelled = false;
    const savedTokenAtStart = settingsTokenRef.current?.trim() ?? "";
    const removeFragment = () =>
      history.replaceState(null, "", clearViewerTokenFromUrl(window.location.href));
    void (async () => {
      try {
        const existing = savedTokenAtStart;
        const credential = await validateViewerLink(sharedToken, existing);
        if (cancelled) return;
        if ((settingsTokenRef.current?.trim() ?? "") !== savedTokenAtStart) {
          removeFragment();
          setSharedToken("");
          return;
        }
        updateSyncToken(credential);
        removeFragment();
        setSharedToken("");
      } catch {
        if (cancelled) return;
        removeFragment();
        setSharedToken("");
        if ((settingsTokenRef.current?.trim() ?? "") === savedTokenAtStart) {
          toast.error("View-only link is invalid or unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sharedToken]);

  useEffect(() => {
    if (canEdit) return;
    setShowAddGoal(false);
    setShowAddOpponentGoal(false);
    setShowAddEvent(false);
    setShowStartMatch(false);
    setShowEndMatchPrompt(false);
    setShowRenameOpponent(false);
    setShowCloseSeason(false);
    setShowRenameSeason(false);
    setPendingDeleteMatch(null);
    setPendingReopenSeasonId(null);
    setShowSecondaryActions(false);
  }, [canEdit]);

  useEffect(() => {
    if (view !== "detail" || !selectedMatch || !selectedMatchSeasonId) return;
    const fresh = getSeasonMatchDetails(selectedMatchSeasonId, selectedMatch.id);
    if (!fresh) {
      setSelectedMatch(null);
      setSelectedMatchSeasonId(null);
      setView(matchDetailOrigin);
    } else if (fresh !== selectedMatch) setSelectedMatch(fresh);
  }, [
    view,
    selectedMatch,
    selectedMatchSeasonId,
    matchHistory,
    seasons,
    getSeasonMatchDetails,
    matchDetailOrigin,
  ]);

  const handleDetectedCalendarTeamName = useCallback(
    (teamName: string) => updateCalendarSettings(settings.calendarUrl, teamName),
    [settings.calendarUrl, updateCalendarSettings],
  );
  const canViewCalendar =
    canEdit ||
    (workspaceRole === "viewer" && syncStatus !== "checking" && syncStatus !== "invalid");
  const upcomingMatches = useUpcomingMatches(
    settings.calendarUrl,
    settings.calendarTeamName,
    canEdit ? handleDetectedCalendarTeamName : undefined,
    canViewCalendar,
  );

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

  const recentMatch = useMemo(() => getRecentMatchWithinDays(matchHistory), [matchHistory]);

  const score = getScore();
  const lastEvent = activeMatch?.events?.[activeMatch.events.length - 1];
  const isPeriodEnded = lastEvent?.type === "period-end";
  const periodStartedAt =
    activeMatch?.periodStartedAt ??
    [...(activeMatch?.events ?? [])].reverse().find((event) => event.type === "start")?.timestamp;

  // Handle starting a new match
  const handleStartMatch = (myTeamName: string, opponentName: string, isHome: boolean) => {
    setScheduledMatchDefaults(null);
    startMatch(myTeamName, opponentName, isHome);
    setView("live");
  };

  const handleSelectUpcomingMatch = (match: UpcomingMatch) => {
    setScheduledMatchDefaults({ opponentName: match.opponentName, isHome: match.isHome });
    setShowStartMatch(true);
  };

  const handleStartPeriod = () => {
    startPeriod();
  };

  const handleEndPeriod = () => {
    const isFinalPeriod =
      activeMatch !== null && activeMatch.currentPeriod === settings.periodsCount;
    endPeriod();
    if (isFinalPeriod) setShowEndMatchPrompt(true);
  };

  const rememberGoalPlayers = (scorer?: string, assist?: string) => {
    if (scorer) addPlayer(scorer);
    if (assist) addPlayer(assist);
  };

  const handleAddMyGoal = (scorer: string, assist: string, type: GoalType) => {
    addGoal("my-team", scorer, assist, type);
    rememberGoalPlayers(scorer, assist);
  };

  const handleUpdateGoal = (id: string, changes: GoalEdit) => {
    updateGoal(id, changes);
    if (activeMatch?.goals.find((goal) => goal.id === id)?.team === "my-team") {
      rememberGoalPlayers(changes.scorer, changes.assist);
    }
  };

  // Handle adding opponent goal
  const handleAddOpponentGoal = (type: GoalType) => {
    addGoal("opponent", undefined, undefined, type);
  };

  // Handle adding an event
  const handleAddEvent = (
    type: GameEventType,
    options?: { team?: "my-team" | "opponent"; player?: string },
  ) => {
    if (type === "start") {
      handleStartPeriod();
    } else if (type === "period-end") {
      handleEndPeriod();
    } else if (type === "pause" || type === "resume") {
      toggleTimer();
    } else {
      const label =
        type === "yellow-card" || type === "red-card"
          ? [
              options?.team
                ? options.team === "my-team"
                  ? (activeMatch?.myTeamName ?? "My Team")
                  : (activeMatch?.opponentName ?? "Opponent")
                : undefined,
              options?.player,
            ]
              .filter(Boolean)
              .join(" • ") || undefined
          : undefined;

      addEvent(type, label, options);

      if (type === "yellow-card" || type === "red-card") {
        if (options?.team === "my-team" && options.player) {
          addPlayer(options.player);
        }
      }
    }
  };

  // Handle ending match
  const handleEndMatch = () => {
    setShowEndMatchPrompt(false);
    if (activeMatch?.isRunning) endPeriod();
    endMatch();
    setView("home");
  };

  const effectiveHistorySeasonId = selectedHistorySeasonId ?? activeSeasonId;
  const historyMatches = effectiveHistorySeasonId
    ? getSeasonMatchHistory(effectiveHistorySeasonId)
    : [];
  const historySeasonStats = effectiveHistorySeasonId
    ? getSeasonStatsById(effectiveHistorySeasonId)
    : null;

  // Handle viewing match details
  const handleSelectMatch = (
    matchId: string,
    seasonId = effectiveHistorySeasonId,
    origin: MatchDetailOrigin = "history",
  ) => {
    if (!seasonId) return;
    const match = getSeasonMatchDetails(seasonId, matchId);
    if (match) {
      setSelectedMatch(match);
      setSelectedMatchSeasonId(seasonId);
      setMatchDetailOrigin(origin);
      setView("detail");
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
    setView("home");
  };

  const handleConfirmReopenSeason = () => {
    if (!pendingReopenSeasonId) return;
    const ok = reopenSeason(pendingReopenSeasonId);
    if (ok) {
      setSelectedHistorySeasonId(pendingReopenSeasonId);
    }
    setPendingReopenSeasonId(null);
  };

  const handleExportBackup = () => {
    const activeSeason = activeSeasonId ? seasons[activeSeasonId] : null;
    const payload = buildBackupPayload({
      matches: activeSeason?.matches ?? [],
      fullMatches: activeSeason?.fullMatches ?? {},
      seasons,
      activeSeasonId: activeSeasonId ?? undefined,
      activeMatch,
      settings,
    });

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename = `goal-keeper-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Backup exported");
  };

  const handleImportBackup = async (file: File) => {
    const text = await file.text();
    const parsed = parseBackupPayload(text);
    if ("error" in parsed) {
      toast.error(parsed.error);
      return;
    }

    setAllMatchesState(parsed.state);
    setAllSettingsState(parsed.state.settings);
    setView(parsed.state.activeMatch ? "live" : "home");
    setSelectedMatch(null);
    setSelectedMatchSeasonId(null);
    setMatchDetailOrigin("history");
    setPendingDeleteMatch(null);
    setPendingReopenSeasonId(null);
    setShowCloseSeason(false);
    setShowRenameOpponent(false);
    setShowRenameSeason(false);
    toast.success("Backup imported");
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
    ? `${selectedSeasonSummary.name}${selectedSeasonSummary.status === "active" ? " (Active)" : ""}`
    : "";

  // If there's an active match and we're on home, show live
  if (activeMatch && view === "home") {
    setView("live");
  }
  if (!activeMatch && view === "live") {
    setView("home");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Settings View */}
      {view === "settings" && (
        <SettingsScreen
          settings={settings}
          onBack={() => setView(activeMatch ? "live" : "home")}
          onUpdateTeamName={updateTeamName}
          onUpdateCalendarSettings={updateCalendarSettings}
          onAddPlayer={addPlayer}
          onRemovePlayer={removePlayer}
          onUpdatePeriods={updatePeriods}
          onUpdateSyncToken={updateSyncToken}
          onUpdateTheme={updateTheme}
          onUpdateDebug={updateDebug}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          canEdit={canEdit}
          syncStatus={syncStatus}
          lastSyncedAt={lastSyncedAt}
          isSyncing={isSyncing}
          isCoolingDown={isCoolingDown}
          onSyncNow={syncNow}
          viewerLink={viewerLink}
          onLoadViewerLink={loadViewerLink}
        />
      )}

      {/* Match Detail View */}
      {view === "detail" && selectedMatch && (
        <MatchDetail
          match={selectedMatch}
          opponentSuggestions={opponentSuggestions}
          onRenameOpponent={
            canEdit
              ? (name) => {
                  const updated = renameHistoricalOpponent(
                    selectedMatch.id,
                    name,
                    selectedMatchSeasonId ?? undefined,
                  );
                  if (updated) setSelectedMatch(updated);
                }
              : undefined
          }
          onBack={() => {
            setSelectedMatch(null);
            setSelectedMatchSeasonId(null);
            setView(matchDetailOrigin);
          }}
        />
      )}

      {/* History View */}
      {view === "history" && (
        <div className="min-h-screen flex flex-col safe-top overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div>
              <h1 className="text-xl font-bold text-foreground">Match History</h1>
              {selectedSeasonLabel ? (
                <button
                  type="button"
                  className="mt-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title={canEdit ? "Long press to rename season" : undefined}
                  onPointerDown={canEdit ? startSeasonNameLongPress : undefined}
                  onPointerUp={canEdit ? cancelSeasonNameLongPress : undefined}
                  onPointerLeave={canEdit ? cancelSeasonNameLongPress : undefined}
                  onPointerCancel={canEdit ? cancelSeasonNameLongPress : undefined}
                  onContextMenu={canEdit ? (e) => e.preventDefault() : undefined}
                  onClick={canEdit ? handleSeasonNameClick : undefined}
                >
                  {selectedSeasonLabel}
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              {canEdit && selectedSeasonSummary?.status === "closed" && (
                <button
                  onClick={() => setPendingReopenSeasonId(selectedSeasonSummary.id)}
                  disabled={!canReopenSeason}
                  className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reopen this season"
                >
                  <RotateCcw className="w-5 h-5 text-foreground" />
                </button>
              )}
              {canEdit && (
                <button
                  onClick={handleOpenCloseSeason}
                  className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                  title="Close season and start new"
                >
                  <CalendarRange className="w-5 h-5 text-foreground" />
                </button>
              )}
              <button
                onClick={() => setView("settings")}
                className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <Settings className="w-5 h-5 text-foreground" />
              </button>
              <button
                onClick={() => setView(activeMatch ? "live" : "home")}
                className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                {activeMatch ? "Back to Match" : "Home"}
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col overflow-hidden">
            {seasonSummaries.length > 0 && (
              <div className="mb-3">
                <label className="text-xs text-muted-foreground mb-1.5 block">Season</label>
                <select
                  value={effectiveHistorySeasonId ?? ""}
                  onChange={(e) => setSelectedHistorySeasonId(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {seasonSummaries.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                      {season.status === "active" ? " (Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {historySeasonStats && (
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-border/30 bg-secondary/40 p-3 text-xs">
                <span>
                  Matches: <strong>{historySeasonStats.matches}</strong>
                </span>
                <span>
                  W / D / L:{" "}
                  <strong>
                    {historySeasonStats.wins} / {historySeasonStats.draws} /{" "}
                    {historySeasonStats.losses}
                  </strong>
                </span>
                <span>
                  Goals:{" "}
                  <strong>
                    {historySeasonStats.goalsFor}-{historySeasonStats.goalsAgainst}
                  </strong>
                </span>
                <span>
                  Top scorer: <strong>{historySeasonStats.topScorer ?? "None"}</strong>
                </span>
              </div>
            )}
            <MatchHistory
              matches={historyMatches}
              onSelectMatch={handleSelectMatch}
              onDeleteMatch={canEdit ? handleRequestDeleteMatch : undefined}
            />
          </div>
        </div>
      )}

      {/* Live Match View */}
      {view === "live" && activeMatch && (
        <LiveMatchLayout
          debug={canEdit && settings.debug}
          header={
            <div className="relative flex items-center justify-between p-4">
              <h1 className="text-lg font-bold text-foreground">⚽ Goal Keeper</h1>
              {settings.syncToken && (
                <button
                  type="button"
                  onClick={syncNow}
                  disabled={isSyncing || isCoolingDown}
                  aria-label={isSyncing ? "Syncing match" : "Sync match"}
                  title={isSyncing ? "Syncing match" : "Sync match"}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`w-5 h-5 text-foreground ${isSyncing ? "animate-spin" : ""}`}
                  />
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setView("settings")}
                  className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <Settings className="w-5 h-5 text-foreground" />
                </button>
                <button
                  onClick={() => setView("history")}
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
                onOpponentLongPress={canEdit ? handleOpenRenameOpponent : undefined}
              />
              <MatchTimer
                startedAt={activeMatch.startedAt}
                periodsCount={settings.periodsCount}
                periodDuration={settings.periodDuration}
                isRunning={activeMatch.isRunning}
                totalPausedTime={activeMatch.totalPausedTime}
                pausedAt={activeMatch.pausedAt}
                currentPeriod={activeMatch.currentPeriod}
                periodStartedAt={periodStartedAt}
                periodPausedTime={activeMatch.periodPausedTime}
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
                editable={canEdit}
                onDeleteGoal={canEdit ? deleteGoal : undefined}
                knownPlayers={settings.players}
                onUpdateGoal={canEdit ? handleUpdateGoal : undefined}
                onDeleteEvent={canEdit ? deleteEvent : undefined}
                onUpdateEventTime={canEdit ? updateEventTime : undefined}
              />
            </>
          }
          actionsHandle={
            canEdit ? (
              <button
                type="button"
                aria-label={showSecondaryActions ? "Hide extra actions" : "Show extra actions"}
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
            ) : undefined
          }
          actions={
            canEdit ? (
              <MatchActions
                onAddMyGoal={() => setShowAddGoal(true)}
                onAddOpponentGoal={() => setShowAddOpponentGoal(true)}
                onAddEvent={() => setShowAddEvent(true)}
                onUndo={undoLast}
                onEndMatch={handleEndMatch}
                onStartPeriod={handleStartPeriod}
                onEndPeriod={handleEndPeriod}
                onToggleTimer={toggleTimer}
                isRunning={activeMatch.isRunning}
                canUndo={activeMatch.goals.length > 0 || activeMatch.events.length > 0}
                currentPeriod={activeMatch.currentPeriod}
                isPeriodEnded={!!isPeriodEnded}
                isHome={activeMatch.isHome}
                showSecondaryActions={showSecondaryActions}
              />
            ) : (
              <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                <span>
                  {syncStatus === "unavailable"
                    ? "Connection unavailable"
                    : syncStatus === "invalid"
                      ? "Access token is invalid"
                      : lastSyncedAt
                        ? `Updated ${new Date(lastSyncedAt).toLocaleTimeString()}`
                        : "Checking workspace"}
                </span>
                {syncStatus !== "invalid" && (
                  <button
                    type="button"
                    onClick={syncNow}
                    disabled={isSyncing || isCoolingDown}
                    className="inline-flex items-center gap-1 py-2 text-primary disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Refreshing" : syncStatus === "unavailable" ? "Retry" : "Refresh"}
                  </button>
                )}
              </div>
            )
          }
        >
          {/* Add Goal Sheet */}
          {canEdit && (
            <AddGoalSheet
              isOpen={showAddGoal}
              onClose={() => setShowAddGoal(false)}
              onAddGoal={handleAddMyGoal}
              knownPlayers={settings.players}
            />
          )}

          {/* Add Opponent Goal Sheet */}
          {canEdit && (
            <AddOpponentGoalSheet
              isOpen={showAddOpponentGoal}
              onClose={() => setShowAddOpponentGoal(false)}
              onAddGoal={handleAddOpponentGoal}
              opponentName={activeMatch.opponentName}
            />
          )}

          {/* Add Event Sheet */}
          {canEdit && (
            <AddEventSheet
              isOpen={showAddEvent}
              onClose={() => setShowAddEvent(false)}
              onAddEvent={handleAddEvent}
              myTeamName={activeMatch.myTeamName}
              opponentName={activeMatch.opponentName}
              knownPlayers={settings.players}
            />
          )}

          <Dialog open={canEdit && showEndMatchPrompt} onOpenChange={setShowEndMatchPrompt}>
            <DialogContent className="max-w-sm rounded-2xl">
              <DialogHeader>
                <DialogTitle>Final whistle?</DialogTitle>
                <DialogDescription>Ready to end the game and save the result?</DialogDescription>
              </DialogHeader>
              <DialogFooter className="!flex-row !justify-center !gap-2 !space-x-0">
                <Button variant="secondary" onClick={() => setShowEndMatchPrompt(false)}>
                  Continue Game
                </Button>
                <Button onClick={handleEndMatch}>End Match</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </LiveMatchLayout>
      )}

      {/* Home View */}
      {view === "home" && !activeMatch && (
        <div className="min-h-screen flex flex-col safe-top">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-2xl font-black text-foreground">⚽️ Goal Keeper</h1>
              <p className="text-sm text-muted-foreground">Track your football matches</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView("settings")}
                className="p-3 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <Settings className="w-5 h-5 text-foreground" />
              </button>
              <button
                onClick={() => setView("history")}
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
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {canEdit ? "Ready to Play?" : "Waiting for a live match"}
              </h2>
              <p className="text-muted-foreground">
                {canEdit
                  ? "Start tracking your match goals in real time"
                  : "View live scores and browse past match results"}
              </p>
              {!canEdit && settings.syncToken && (
                <div className="mt-4 flex flex-col items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {syncStatus === "unavailable"
                      ? "Connection unavailable"
                      : syncStatus === "invalid"
                        ? "Access token is invalid"
                        : lastSyncedAt
                          ? `Last updated ${new Date(lastSyncedAt).toLocaleTimeString()}`
                          : "Checking workspace"}
                  </span>
                  {syncStatus !== "invalid" && (
                    <button
                      type="button"
                      onClick={syncNow}
                      disabled={isSyncing || isCoolingDown}
                      className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-foreground disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                      {isSyncing
                        ? "Refreshing"
                        : syncStatus === "unavailable"
                          ? "Retry"
                          : "Refresh"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {canEdit && (
              <button
                onClick={() => {
                  setScheduledMatchDefaults(null);
                  setShowStartMatch(true);
                }}
                className="w-full max-w-xs py-5 bg-primary text-primary-foreground font-bold text-xl rounded-2xl hover:bg-primary/90 transition-all active:scale-[0.98] btn-glow"
              >
                Start New Match
              </button>
            )}

            {recentMatch && (
              <div className="w-full max-w-xs mt-6 card-gradient rounded-xl border border-border/30 overflow-hidden">
                <MatchResultCard
                  match={recentMatch}
                  onSelect={() =>
                    handleSelectMatch(recentMatch.id, activeSeasonId ?? undefined, "home")
                  }
                />
              </div>
            )}

            {activeSeasonMatchCount > 0 && (
              <button
                onClick={() => setView("history")}
                className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View {activeSeasonMatchCount} past match{activeSeasonMatchCount !== 1 ? "es" : ""}
              </button>
            )}

            {canViewCalendar && (
              <UpcomingMatches
                matches={upcomingMatches.matches}
                loaded={upcomingMatches.loaded}
                onSelect={canEdit ? handleSelectUpcomingMatch : undefined}
                onRefresh={upcomingMatches.refresh}
              />
            )}
          </div>

          {/* Start Match Sheet */}
          {canEdit && (
            <StartMatchSheet
              isOpen={showStartMatch}
              onClose={() => setShowStartMatch(false)}
              onStartMatch={handleStartMatch}
              defaultTeamName={settings.teamName}
              opponentSuggestions={opponentSuggestions}
              initialOpponentName={scheduledMatchDefaults?.opponentName}
              initialIsHome={scheduledMatchDefaults?.isHome}
            />
          )}
        </div>
      )}

      <AlertDialog
        open={canEdit && !!pendingDeleteMatch}
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
                : "This will permanently remove the selected match from your history."}
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
        open={canEdit && !!pendingReopenSeasonId}
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
        open={canEdit && showCloseSeason}
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
                {activeSeasonStats?.wins ?? 0} / {activeSeasonStats?.draws ?? 0} /{" "}
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
              <span className="font-semibold text-foreground">{activeSeasonTopScorer ?? "—"}</span>
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
        open={canEdit && showRenameSeason}
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
        open={canEdit && showRenameOpponent}
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
