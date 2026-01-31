import { useState, useEffect, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS, Theme } from '@/types/match';

const SETTINGS_KEY = 'football-tracker-settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    }
  }, []);

  // Save to localStorage when settings change
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateTeamName = useCallback((teamName: string) => {
    setSettings((prev) => ({ ...prev, teamName }));
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

  const setAllSettingsState = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
  }, []);

  return {
    settings,
    updateTeamName,
    updatePlayers,
    addPlayer,
    removePlayer,
    updatePeriods,
    updateSyncToken,
    updateTheme,
    setAllSettingsState,
  };
}
