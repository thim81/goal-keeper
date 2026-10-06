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

  const updateSyncToken = useCallback((syncToken: string) => {
    setSettings((prev) => ({ ...prev, syncToken }));
  }, []);

  const updateTheme = useCallback((theme: Theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const setAllSettingsState = useCallback((newSettings: AppSettings) => {
    setSettings({ ...DEFAULT_SETTINGS, ...newSettings });
  }, []);

  return {
    settings,
    updateSyncToken,
    updateTheme,
    setAllSettingsState,
  };
}
