import { useState, useEffect, useCallback } from "react";
import { AppSettings, DEFAULT_SETTINGS, Theme } from "@/types/match";
import { readWorkspaceCache, preserveLegacyCache } from "@/lib/workspace-cache";
import { normalizeSharedSettings } from "@/lib/workspace";

const SETTINGS_KEY = "football-tracker-settings";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    preserveLegacyCache();
    let deviceSettings = DEFAULT_SETTINGS;
    try {
      const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        deviceSettings = {
          ...DEFAULT_SETTINGS,
          theme: ["light", "dark", "system"].includes(parsed.theme)
            ? parsed.theme
            : DEFAULT_SETTINGS.theme,
          syncToken: typeof parsed.syncToken === "string" ? parsed.syncToken : "",
        };
        deviceSettings = { ...deviceSettings, ...normalizeSharedSettings(parsed) };
      }
    } catch {
      // Keep cached shared data readable even if the device settings are corrupt.
    }
    const cache = readWorkspaceCache();
    return cache?.credential === (deviceSettings.syncToken?.trim() ?? "")
      ? { ...deviceSettings, ...cache.state.settings }
      : deviceSettings;
  });

  // Save to localStorage when settings change
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Storage failure must not prevent viewing the workspace.
    }
  }, [settings]);

  const updateTeamName = useCallback((teamName: string) => {
    setSettings((prev) => ({ ...prev, teamName }));
  }, []);

  const updateCalendarSettings = useCallback((calendarUrl: string, calendarTeamName: string) => {
    setSettings((prev) => ({
      ...prev,
      calendarUrl: calendarUrl.trim(),
      calendarTeamName: calendarTeamName.trim(),
    }));
  }, []);

  const updatePlayers = useCallback((players: string[]) => {
    setSettings((prev) => ({ ...prev, players }));
  }, []);

  const addPlayer = useCallback(
    (player: string) => {
      if (player.trim() && !settings.players.includes(player.trim())) {
        setSettings((prev) => ({ ...prev, players: [...prev.players, player.trim()] }));
      }
    },
    [settings.players],
  );

  const removePlayer = useCallback((player: string) => {
    setSettings((prev) => ({ ...prev, players: prev.players.filter((p) => p !== player) }));
  }, []);

  const updatePeriods = useCallback((periodsCount: number, periodDuration: number) => {
    setSettings((prev) => ({ ...prev, periodsCount, periodDuration }));
  }, []);

  const updateSyncToken = useCallback((syncToken: string) => {
    setSettings((prev) => ({ ...prev, syncToken }));
  }, []);

  const updateTheme = useCallback((theme: Theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const updateDebug = useCallback((debug: boolean) => {
    setSettings((prev) => ({ ...prev, debug }));
  }, []);

  const setAllSettingsState = useCallback((newSettings: AppSettings) => {
    setSettings({ ...DEFAULT_SETTINGS, ...newSettings });
  }, []);

  return {
    settings,
    updateTeamName,
    updateCalendarSettings,
    updatePlayers,
    addPlayer,
    removePlayer,
    updatePeriods,
    updateSyncToken,
    updateTheme,
    updateDebug,
    setAllSettingsState,
  };
}
