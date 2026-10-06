import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { History, RefreshCw, Settings } from "lucide-react";
import { useMatches } from "@/hooks/useMatches";
import { useSettings } from "@/hooks/useSettings";
import { useTheme } from "@/hooks/useTheme";
import { unstable_batchedUpdates } from "react-dom";
import { assembleWorkspace } from "@/lib/workspace-cache";
import { normalizeWorkspace, workspaceTimeline } from "@/lib/workspace";
import { useWorkspaceActions } from "@/hooks/useWorkspaceActions";
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
import { MatchHistoryScreen } from "@/components/MatchHistoryScreen";
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
import { useMatchCountdown } from "@/hooks/useMatchCountdown";
import { MatchCountdown } from "@/components/MatchCountdown";
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
  const [showRenameOpponent, setShowRenameOpponent] = useState(false);
  const [opponentNameDraft, setOpponentNameDraft] = useState("");
  const [viewerLink, setViewerLink] = useState("");
  const [sharedToken, setSharedToken] = useState(() =>
    typeof window === "undefined" ? "" : (getViewerTokenFromUrl(window.location.href) ?? ""),
  );
  const [pendingWorkspaceToken, setPendingWorkspaceToken] = useState<{
    token: string;
    fromLink: boolean;
  } | null>(null);
  const [selectedHistorySeasonId, setSelectedHistorySeasonId] = useState<string | null>(null);
  const [syncScrollSignal, setSyncScrollSignal] = useState(0);
  const dragStartY = useRef(0);
  const dragging = useRef(false);

  const {
    activeMatch,
    activeSeasonId,
    seasons,
    matchHistory,
    getScore,
    getSeasonSummaries,
    getSeasonStatsById,
    getSeasonMatchHistory,
    getSeasonMatchDetails,
    setAllMatchesState,
    setActiveMatchState,
    canCloseSeason,
    canReopenSeason,
  } = useMatches();

  const { settings, updateSyncToken, updateTheme, setAllSettingsState } = useSettings();
  const settingsTokenRef = useRef(settings.syncToken);
  settingsTokenRef.current = settings.syncToken;
  const shareRequestRef = useRef(0);

  const handleSyncState = useCallback(
    (input: SyncState) => {
      const state = normalizeWorkspace(input);
      unstable_batchedUpdates(() => {
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
    isCredentialConfirmed,
    submitCommand,
    metadata,
    isWorkspaceStale,
  } = useSync(
    sharedToken ? undefined : settings.syncToken,
    seasons,
    activeSeasonId,
    activeMatch,
    settings,
    handleSyncState,
    setActiveMatchState,
  );
  const canEdit =
    !sharedToken &&
    ((workspaceRole === "editor" && isCredentialConfirmed) ||
      (syncStatus === "local" && !settings.syncToken));
  const dispatch = useWorkspaceActions(
    assembleWorkspace(seasons, activeSeasonId, activeMatch, settings),
    !settings.syncToken && !sharedToken,
    handleSyncState,
    submitCommand,
  );
  const liveAction = (
    type: Parameters<typeof dispatch>[0],
    payload: Record<string, unknown> = {},
  ) =>
    activeMatch ? dispatch(type, payload, { matchId: activeMatch.id }) : Promise.resolve(false);
  const updateTeamName = (teamName: string) =>
    dispatch("update-settings", { settings: { teamName } });
  const updateCalendarSettings = (calendarUrl: string, calendarTeamName: string) =>
    dispatch("update-settings", { settings: { calendarUrl, calendarTeamName } });
  const addPlayer = (player: string) => dispatch("add-player", { player });
  const removePlayer = (player: string) => dispatch("remove-player", { player });
  const updatePeriods = (periodsCount: number, periodDuration: number) =>
    dispatch("update-settings", { settings: { periodsCount, periodDuration } });
  const updateDebug = (debug: boolean) => dispatch("update-settings", { settings: { debug } });
  const deleteGoal = (goalId: string) => liveAction("delete-goal", { goalId });
  const deleteEvent = (eventId: string) => liveAction("delete-event", { eventId });
  const updateEventTime = (eventId: string, time: string) =>
    liveAction("update-event-time", { eventId, time });
  const toggleTimer = () => liveAction(activeMatch?.isRunning ? "pause-match" : "resume-match");
  const undoLast = () => {
    const items = workspaceTimeline(activeMatch?.goals ?? [], activeMatch?.events ?? []);
    const latest = items[items.length - 1];
    if (!latest) return Promise.resolve(false);
    return latest.kind === "goal" ? deleteGoal(latest.data.id) : deleteEvent(latest.data.id);
  };
  const closeAndStartNewSeason = (options?: { name?: string }) =>
    dispatch("close-season", { name: options?.name }, { seasonId: activeSeasonId ?? undefined });
  const reopenSeason = (seasonId: string) => dispatch("reopen-season", {}, { seasonId });
  const renameSeasonName = (seasonId: string, name: string) =>
    dispatch("rename-season", { name }, { seasonId });
  const renameHistoricalOpponent = (matchId: string, name: string, seasonId?: string) =>
    dispatch("rename-historical-opponent", { name }, { matchId, seasonId });
  const hasLocalData =
    !!activeMatch ||
    Object.keys(seasons).length > 1 ||
    Object.values(seasons).some(
      (season) =>
        season.matches.length > 0 ||
        Object.keys(season.fullMatches).length > 0 ||
        season.status !== "active" ||
        season.name !== createDefaultSeasonName(season.startAt),
    );
  const handleUpdateSyncToken = (token: string) => {
    if (token && token !== settings.syncToken && hasLocalData) {
      setPendingWorkspaceToken({ token, fromLink: false });
      return false;
    }
    updateSyncToken(token);
  };

  const loadViewerLink = useCallback(async () => {
    if (!settings.syncToken || workspaceRole !== "editor") return "";
    const token = settings.syncToken;
    const requestId = ++shareRequestRef.current;
    try {
      const response = await fetch("/api/share", { headers: { "x-auth-token": token } });
      if (response.status === 503) {
        if (settingsTokenRef.current === token && requestId === shareRequestRef.current)
          setViewerLink("");
        return null;
      }
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
    if (!sharedToken || !activeSeasonId || pendingWorkspaceToken) return;
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
        if (credential !== savedTokenAtStart && hasLocalData) {
          removeFragment();
          setPendingWorkspaceToken({ token: credential, fromLink: true });
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
  }, [sharedToken, activeSeasonId, pendingWorkspaceToken, hasLocalData]);

  useEffect(() => {
    if (canEdit) return;
    setShowAddGoal(false);
    setShowAddOpponentGoal(false);
    setShowAddEvent(false);
    setShowStartMatch(false);
    setShowEndMatchPrompt(false);
    setShowRenameOpponent(false);
    setPendingDeleteMatch(null);
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
    (teamName: string) => {
      if (teamName !== settings.calendarTeamName)
        void updateCalendarSettings(settings.calendarUrl, teamName);
    },
    [settings.calendarUrl, settings.calendarTeamName, dispatch],
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

  const countdown = useMatchCountdown(
    upcomingMatches.matches,
    view === "home" && !activeMatch && upcomingMatches.loaded,
  );

  const handleToggleSecondary = (open: boolean) => {
    setShowSecondaryActions(open);
  };

  const handleOpenRenameOpponent = useCallback(() => {
    if (!activeMatch) return;
    setOpponentNameDraft(activeMatch.opponentName);
    setShowRenameOpponent(true);
  }, [activeMatch]);

  const handleSaveRenameOpponent = async () => {
    const trimmed = opponentNameDraft.trim();
    if (!trimmed) return;
    if (await liveAction("rename-opponent", { name: trimmed })) setShowRenameOpponent(false);
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
  const lastEvent = [...(activeMatch?.events ?? [])]
    .reverse()
    .find((event) => event.type === "start" || event.type === "period-end");
  const isPeriodEnded = lastEvent?.type === "period-end";
  const periodStartedAt =
    activeMatch?.periodStartedAt ??
    [...(activeMatch?.events ?? [])].reverse().find((event) => event.type === "start")?.timestamp;

  const handleStartMatch = async (myTeamName: string, opponentName: string, isHome: boolean) => {
    if (!(await dispatch("start-match", { myTeamName, opponentName, isHome }))) return false;
    setScheduledMatchDefaults(null);
    setView("live");
    return true;
  };
  const handleSelectUpcomingMatch = (match: UpcomingMatch) => {
    setScheduledMatchDefaults({ opponentName: match.opponentName, isHome: match.isHome });
    setShowStartMatch(true);
  };
  const handleStartPeriod = () =>
    liveAction("start-period", { expectedPeriod: activeMatch?.currentPeriod });
  const handleEndPeriod = async () => {
    const final = activeMatch?.currentPeriod === settings.periodsCount;
    if (!(await liveAction("end-period", { expectedPeriod: activeMatch?.currentPeriod })))
      return false;
    if (final) setShowEndMatchPrompt(true);
    return true;
  };
  const handleAddMyGoal = (scorer: string, assist: string, type: GoalType) =>
    liveAction("add-goal", { team: "my-team", scorer, assist, type });
  const handleUpdateGoal = (goalId: string, changes: GoalEdit) =>
    liveAction("update-goal", { goalId, changes });
  const handleAddOpponentGoal = (type: GoalType) =>
    liveAction("add-goal", { team: "opponent", type });
  const handleAddEvent = (
    type: GameEventType,
    options?: { team?: "my-team" | "opponent"; player?: string },
  ) => {
    if (type === "start") return handleStartPeriod();
    if (type === "period-end") return handleEndPeriod();
    if (type === "pause" || type === "resume") return toggleTimer();
    const label =
      [
        options?.team
          ? options.team === "my-team"
            ? activeMatch?.myTeamName
            : activeMatch?.opponentName
          : undefined,
        options?.player,
      ]
        .filter(Boolean)
        .join(" • ") || undefined;
    return liveAction("add-event", { eventType: type, label, ...options });
  };
  const handleEndMatch = async () => {
    if (!(await liveAction("end-match"))) return false;
    setShowEndMatchPrompt(false);
    setView("home");
    return true;
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

  const handleConfirmDeleteMatch = async (event?: React.MouseEvent) => {
    event?.preventDefault();
    if (!pendingDeleteMatch) return;
    if (
      await dispatch(
        "delete-historical-match",
        {},
        { matchId: pendingDeleteMatch.matchId, seasonId: pendingDeleteMatch.seasonId },
      )
    )
      setPendingDeleteMatch(null);
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

    if (
      settings.syncToken &&
      !window.confirm(
        "Replace the complete workspace with this backup? The current server workspace will be preserved for recovery.",
      )
    )
      return;
    if (
      !(await dispatch(
        "import-backup",
        { confirmed: true, state: normalizeWorkspace(parsed.state) },
        {
          expectedRevision: settings.syncToken
            ? Math.max(metadata.liveRevision, metadata.fullRevision)
            : undefined,
        },
      ))
    )
      return;
    setView(parsed.state.activeMatch ? "live" : "home");
    setSelectedMatch(null);
    setSelectedMatchSeasonId(null);
    setMatchDetailOrigin("history");
    setPendingDeleteMatch(null);
    setShowRenameOpponent(false);
    toast.success("Backup imported");
  };

  const activeSeasonStats = activeSeasonId ? getSeasonStatsById(activeSeasonId) : null;
  const activeSeasonMatchCount = activeSeasonStats?.matches ?? 0;

  const selectedSeasonSummary = seasonSummaries.find(
    (season) => season.id === effectiveHistorySeasonId,
  );
  // If there's an active match and we're on home, show live
  if (activeMatch && view === "home") {
    setView("live");
  }
  if (!activeMatch && view === "live") {
    setView("home");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {isWorkspaceStale && (
        <div role="status" className="px-4 py-2 text-sm bg-secondary">
          History and settings are cached. Refreshing workspace…
        </div>
      )}
      <>
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
            onUpdateSyncToken={handleUpdateSyncToken}
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
                    return renameHistoricalOpponent(
                      selectedMatch.id,
                      name,
                      selectedMatchSeasonId ?? undefined,
                    );
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
          <MatchHistoryScreen
            seasons={seasonSummaries}
            selectedSeasonId={effectiveHistorySeasonId}
            selectedSeason={selectedSeasonSummary}
            matches={historyMatches}
            stats={historySeasonStats}
            activeSeasonStats={activeSeasonStats}
            canEdit={canEdit}
            canCloseSeason={canCloseSeason}
            canReopenSeason={canReopenSeason}
            hasActiveMatch={!!activeMatch}
            onSelectSeason={setSelectedHistorySeasonId}
            onSelectMatch={handleSelectMatch}
            onDeleteMatch={canEdit ? handleRequestDeleteMatch : undefined}
            onOpenSettings={() => setView("settings")}
            onGoHome={() => setView(activeMatch ? "live" : "home")}
            onCloseSeason={async (name) => {
              const success = await closeAndStartNewSeason({ name });
              if (success) setView("home");
              return success;
            }}
            onReopenSeason={async (seasonId) => {
              const success = await reopenSeason(seasonId);
              if (success) setSelectedHistorySeasonId(seasonId);
              return success;
            }}
            onRenameSeason={renameSeasonName}
          />
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
                    aria-label="Settings"
                    onClick={() => setView("settings")}
                    className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    <Settings className="w-5 h-5 text-foreground" />
                  </button>
                  <button
                    aria-label="History"
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
                      {isSyncing
                        ? "Refreshing"
                        : syncStatus === "unavailable"
                          ? "Retry"
                          : "Refresh"}
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
                  aria-label="Settings"
                  onClick={() => setView("settings")}
                  className="p-3 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <Settings className="w-5 h-5 text-foreground" />
                </button>
                <button
                  aria-label="History"
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
                  {canEdit
                    ? "Ready to Play?"
                    : countdown
                      ? "Get ready for kickoff"
                      : "Waiting for the next match"}
                </h2>
                <p className="text-muted-foreground">
                  {canEdit
                    ? "Start tracking your match goals in real time"
                    : "View live scores and browse past match results"}
                </p>
              </div>

              {countdown && (
                <MatchCountdown
                  match={countdown.match}
                  teamName={settings.teamName}
                  secondsRemaining={countdown.secondsRemaining}
                  onStart={canEdit ? () => handleSelectUpcomingMatch(countdown.match) : undefined}
                />
              )}

              {!canEdit && settings.syncToken && (
                <div className="mb-6 flex flex-col items-center gap-2 text-xs text-muted-foreground">
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

              {canEdit && (
                <button
                  onClick={() => {
                    setScheduledMatchDefaults(null);
                    setShowStartMatch(true);
                  }}
                  className={
                    countdown
                      ? "mt-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                      : "w-full max-w-xs py-5 bg-primary text-primary-foreground font-bold text-xl rounded-2xl hover:bg-primary/90 transition-all active:scale-[0.98] btn-glow"
                  }
                >
                  {countdown ? "Start a different match" : "Start New Match"}
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
                  aria-label="History"
                  onClick={() => setView("history")}
                  className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  View {activeSeasonMatchCount} past match{activeSeasonMatchCount !== 1 ? "es" : ""}
                </button>
              )}

              {canViewCalendar && !countdown && (
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
          open={!!pendingWorkspaceToken}
          onOpenChange={(open) => {
            if (!open) {
              setPendingWorkspaceToken(null);
              setSharedToken("");
            }
          }}
        >
          <AlertDialogContent className="max-w-sm rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Replace local match data?</AlertDialogTitle>
              <AlertDialogDescription>
                Joining this workspace may replace the matches and seasons saved on this device.
                Download a backup first if you want to keep them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Button type="button" variant="secondary" onClick={handleExportBackup}>
              Download backup
            </Button>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingWorkspaceToken) updateSyncToken(pendingWorkspaceToken.token);
                  setPendingWorkspaceToken(null);
                  setSharedToken("");
                }}
              >
                {pendingWorkspaceToken?.fromLink
                  ? "Open view-only workspace"
                  : "Connect to workspace"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
      </>
    </div>
  );
}
