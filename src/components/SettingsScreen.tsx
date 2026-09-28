import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Plus,
  X,
  Users,
  Clock,
  Shield,
  RefreshCw,
  Moon,
  Sun,
  Laptop,
  Bug,
  Download,
  Upload,
  Copy,
} from "lucide-react";
import { AppSettings, Theme } from "@/types/match";
import { SecretInput } from "@/components/SecretInput";
import { toast } from "sonner";

interface SettingsScreenProps {
  settings: AppSettings;
  onBack: () => void;
  onUpdateTeamName: (name: string) => void;
  onUpdateCalendarSettings: (url: string, teamName: string) => void;
  onAddPlayer: (name: string) => void;
  onRemovePlayer: (name: string) => void;
  onUpdatePeriods: (count: number, duration: number) => void;
  onUpdateSyncToken: (token: string) => void | boolean;
  onUpdateTheme: (theme: Theme) => void;
  onUpdateDebug: (debug: boolean) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => Promise<void> | void;
  canEdit?: boolean;
  syncStatus?: string;
  lastSyncedAt?: number | null;
  isSyncing?: boolean;
  isCoolingDown?: boolean;
  onSyncNow?: () => void;
  viewerLink?: string;
  onLoadViewerLink?: () => Promise<string | null>;
}

export function SettingsScreen({
  settings,
  onBack,
  onUpdateTeamName,
  onUpdateCalendarSettings,
  onAddPlayer,
  onRemovePlayer,
  onUpdatePeriods,
  onUpdateSyncToken,
  onUpdateTheme,
  onUpdateDebug,
  onExportBackup,
  onImportBackup,
  canEdit = true,
  syncStatus = "local",
  lastSyncedAt = null,
  isSyncing = false,
  isCoolingDown = false,
  onSyncNow = () => undefined,
  viewerLink = "",
  onLoadViewerLink = async () => "",
}: SettingsScreenProps) {
  const [newPlayer, setNewPlayer] = useState("");
  const [teamName, setTeamName] = useState(settings.teamName);
  const [calendarUrl, setCalendarUrl] = useState(settings.calendarUrl);
  const [calendarTeamName, setCalendarTeamName] = useState(settings.calendarTeamName);
  const [syncToken, setSyncToken] = useState(settings.syncToken || "");
  const [showSyncToken, setShowSyncToken] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [shareUnavailable, setShareUnavailable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (syncStatus === "editor") {
      setShareUnavailable(false);
      void onLoadViewerLink().then(
        (link) => {
          if (cancelled) return;
          setShareUnavailable(link === null);
          setShareFailed(link === "");
        },
        () => {
          if (!cancelled) setShareFailed(true);
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [syncStatus, onLoadViewerLink]);

  useEffect(() => setSyncToken(settings.syncToken || ""), [settings.syncToken]);

  useEffect(() => {
    setCalendarUrl(settings.calendarUrl);
    setCalendarTeamName(settings.calendarTeamName);
  }, [settings.calendarTeamName, settings.calendarUrl]);

  const handleAddPlayer = () => {
    if (newPlayer.trim()) {
      onAddPlayer(newPlayer.trim());
      setNewPlayer("");
    }
  };

  const handleTeamNameBlur = () => {
    if (teamName.trim() && teamName !== settings.teamName) {
      onUpdateTeamName(teamName.trim());
    }
  };

  const handleCalendarSettingsBlur = () => {
    onUpdateCalendarSettings(calendarUrl, calendarTeamName);
  };

  const loadViewerLinkForAction = async () => {
    try {
      const link = await onLoadViewerLink();
      setShareUnavailable(link === null);
      setShareFailed(link === "");
      return link ?? "";
    } catch {
      setShareFailed(true);
      return "";
    }
  };

  const handleSyncTokenBlur = () => {
    if (syncToken !== settings.syncToken) {
      if (onUpdateSyncToken(syncToken.trim()) === false) setSyncToken(settings.syncToken || "");
    }
  };

  const handlePickImportFile = () => {
    fileInputRef.current?.click();
  };

  const syncLabel =
    syncStatus === "local"
      ? "Local only"
      : syncStatus === "checking"
        ? "Checking…"
        : syncStatus === "editor"
          ? "Editor"
          : syncStatus === "viewer"
            ? "Viewer"
            : syncStatus === "invalid"
              ? "Invalid token"
              : "Unavailable";

  return (
    <div
      className="flex flex-col safe-top overflow-hidden"
      style={{ height: "calc(var(--vh, 1vh) * 100)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/30">
        <button
          onClick={onBack}
          className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-none"
        style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom, 0px))` }}
      >
        {/* Team Name */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Team Name</span>
          </div>
          {canEdit ? (
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onBlur={handleTeamNameBlur}
              placeholder="Enter your team name"
              className="w-full px-4 py-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary text-lg"
            />
          ) : (
            <p className="w-full px-4 py-4 bg-secondary rounded-xl text-foreground text-lg">
              {settings.teamName}
            </p>
          )}
        </div>

        {canEdit && (
          <>
            {/* Match Format */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Match Format</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Periods</label>
                  <select
                    value={settings.periodsCount}
                    onChange={(e) =>
                      onUpdatePeriods(parseInt(e.target.value), settings.periodDuration)
                    }
                    className="w-full px-4 py-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} period{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Minutes each</label>
                  <select
                    value={settings.periodDuration}
                    onChange={(e) =>
                      onUpdatePeriods(settings.periodsCount, parseInt(e.target.value))
                    }
                    className="w-full px-4 py-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {[10, 15, 20, 25, 30, 35, 40, 45].map((n) => (
                      <option key={n} value={n}>
                        {n} min
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Total match time: {settings.periodsCount * settings.periodDuration} minutes
              </p>
            </div>

            {/* Players */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Players</span>
              </div>

              {/* Add player */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPlayer}
                  onChange={(e) => setNewPlayer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
                  placeholder="Add player name"
                  className="flex-1 px-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleAddPlayer}
                  disabled={!newPlayer.trim()}
                  className="px-4 py-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Player list */}
              {settings.players.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {settings.players.map((player) => (
                    <div
                      key={player}
                      className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg group"
                    >
                      <span className="text-foreground">{player}</span>
                      <button
                        onClick={() => onRemovePlayer(player)}
                        className="p-1 rounded-full hover:bg-accent/20 transition-colors"
                      >
                        <X className="w-3 h-3 text-muted-foreground hover:text-accent" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No players added yet. Add players to use autocomplete when scoring.
                </p>
              )}
            </div>
          </>
        )}

        {/* Theme */}
        <div className="space-y-3 pt-4 border-t border-border/30">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sun className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Appearance</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onUpdateTheme("light")}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                settings.theme === "light"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun className="w-5 h-5" />
              <span className="text-xs font-medium">Light</span>
            </button>
            <button
              onClick={() => onUpdateTheme("dark")}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                settings.theme === "dark"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Moon className="w-5 h-5" />
              <span className="text-xs font-medium">Dark</span>
            </button>
            <button
              onClick={() => onUpdateTheme("system")}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                settings.theme === "system"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Laptop className="w-5 h-5" />
              <span className="text-xs font-medium">System</span>
            </button>
          </div>
        </div>

        {/* Sync */}
        <div className="space-y-3 pt-4 border-t border-border/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4" />
              <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider sm:text-sm">
                Cloud Sync
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="whitespace-nowrap text-xs font-medium text-muted-foreground"
                role="status"
              >
                {syncLabel}
              </span>
              {syncStatus === "editor" && !shareUnavailable && (
                <button
                  type="button"
                  disabled={!viewerLink && !shareFailed}
                  onClick={async () => {
                    try {
                      const link = viewerLink || (await loadViewerLinkForAction());
                      if (!link) throw new Error("Could not load view-only link");
                      await navigator.clipboard.writeText(link);
                      setShareFailed(false);
                      toast.success("View link copied");
                    } catch {
                      toast.error("Could not copy view link");
                    }
                  }}
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-secondary px-2 py-1 text-xs disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Share link</span>
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <SecretInput
              value={syncToken}
              onChange={setSyncToken}
              onBlur={handleSyncTokenBlur}
              placeholder="Enter sync token"
              visible={showSyncToken}
              onToggleVisibility={() => setShowSyncToken((visible) => !visible)}
              showLabel="Show sync token"
              hideLabel="Hide sync token"
            />
            <p className="text-[10px] text-muted-foreground leading-tight">
              Enter your token to sync matches across devices.
            </p>
            <div className="flex items-center gap-2">
              {lastSyncedAt && (
                <p className="text-[10px] text-muted-foreground">
                  Last refreshed {new Date(lastSyncedAt).toLocaleTimeString()}
                </p>
              )}
              {syncStatus !== "local" && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={isSyncing || isCoolingDown}
                  className="ml-auto whitespace-nowrap text-xs text-primary disabled:opacity-50"
                >
                  {isSyncing
                    ? "Refreshing…"
                    : syncStatus === "invalid" || syncStatus === "unavailable"
                      ? "Retry connection"
                      : "Refresh workspace"}
                </button>
              )}
            </div>
          </div>
        </div>

        {canEdit && (
          <>
            {/* Calendar */}
            <div className="space-y-3 pt-4 border-t border-border/30">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">
                  Upcoming Matches
                </span>
              </div>
              <div className="space-y-2">
                <input
                  type="url"
                  value={calendarUrl}
                  onChange={(e) => setCalendarUrl(e.target.value)}
                  onBlur={handleCalendarSettingsBlur}
                  placeholder="Paste ProSoccerData subscription URL"
                  className="w-full px-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  value={calendarTeamName}
                  onChange={(e) => setCalendarTeamName(e.target.value)}
                  onBlur={handleCalendarSettingsBlur}
                  placeholder="Detected automatically, for example IPU15"
                  className="w-full px-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Only scheduled games are shown. The team label is detected from the calendar when
                  left blank.
                </p>
              </div>
            </div>
            {/* Backup */}
            <div className="space-y-3 pt-4 border-t border-border/30">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Download className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">
                  Backup (JSON)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onExportBackup}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <Download className="w-4 h-4 text-foreground" />
                  <span className="text-sm font-medium text-foreground">Export</span>
                </button>
                <button
                  onClick={handlePickImportFile}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <Upload className="w-4 h-4 text-foreground" />
                  <span className="text-sm font-medium text-foreground">Import</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await onImportBackup(file);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Export a full backup of seasons, matches and settings, or import a previous backup.
              </p>
            </div>
            {/* Debug Mode */}
            <div className="space-y-3 pt-4 border-t border-border/30">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Bug className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Debug Mode</span>
              </div>
              <button
                onClick={() => onUpdateDebug(!settings.debug)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  settings.debug
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-secondary hover:bg-secondary/80"
                }`}
              >
                <span className="text-foreground font-medium">Show debug overlay</span>
                <div
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.debug ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      settings.debug ? "translate-x-6" : "translate-x-0.5"
                    } mt-0.5`}
                  />
                </div>
              </button>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Display viewport measurements and layout information during live matches.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
