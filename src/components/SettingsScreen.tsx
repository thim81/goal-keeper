import { useState } from 'react';
import { ArrowLeft, Plus, X, Users, Clock, Shield, RefreshCw, Moon, Sun, Laptop, Bug } from 'lucide-react';
import { AppSettings, Theme } from '@/types/match';

interface SettingsScreenProps {
  settings: AppSettings;
  onBack: () => void;
  onUpdateTeamName: (name: string) => void;
  onAddPlayer: (name: string) => void;
  onRemovePlayer: (name: string) => void;
  onUpdatePeriods: (count: number, duration: number) => void;
  onUpdateSyncToken: (token: string) => void;
  onUpdateTheme: (theme: Theme) => void;
  onUpdateDebug: (debug: boolean) => void;
}

export function SettingsScreen({
  settings,
  onBack,
  onUpdateTeamName,
  onAddPlayer,
  onRemovePlayer,
  onUpdatePeriods,
  onUpdateSyncToken,
  onUpdateTheme,
  onUpdateDebug,
}: SettingsScreenProps) {
  const [newPlayer, setNewPlayer] = useState('');
  const [teamName, setTeamName] = useState(settings.teamName);
  const [syncToken, setSyncToken] = useState(settings.syncToken || '');

  const handleAddPlayer = () => {
    if (newPlayer.trim()) {
      onAddPlayer(newPlayer.trim());
      setNewPlayer('');
    }
  };

  const handleTeamNameBlur = () => {
    if (teamName.trim() && teamName !== settings.teamName) {
      onUpdateTeamName(teamName.trim());
    }
  };

  const handleSyncTokenBlur = () => {
    if (syncToken !== settings.syncToken) {
      onUpdateSyncToken(syncToken.trim());
    }
  };

  return (
    <div
      className="flex flex-col safe-top overflow-hidden"
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
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
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            onBlur={handleTeamNameBlur}
            placeholder="Enter your team name"
            className="w-full px-4 py-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary text-lg"
          />
        </div>

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
                onChange={(e) => onUpdatePeriods(parseInt(e.target.value), settings.periodDuration)}
                className="w-full px-4 py-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} period{n > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Minutes each</label>
              <select
                value={settings.periodDuration}
                onChange={(e) => onUpdatePeriods(settings.periodsCount, parseInt(e.target.value))}
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
              onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
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

        {/* Theme */}
        <div className="space-y-3 pt-4 border-t border-border/30">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sun className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Appearance</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onUpdateTheme('light')}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                settings.theme === 'light'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-transparent bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sun className="w-5 h-5" />
              <span className="text-xs font-medium">Light</span>
            </button>
            <button
              onClick={() => onUpdateTheme('dark')}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                settings.theme === 'dark'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-transparent bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <Moon className="w-5 h-5" />
              <span className="text-xs font-medium">Dark</span>
            </button>
            <button
              onClick={() => onUpdateTheme('system')}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                settings.theme === 'system'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-transparent bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <Laptop className="w-5 h-5" />
              <span className="text-xs font-medium">System</span>
            </button>
          </div>
        </div>

        {/* Sync */}
        <div className="space-y-3 pt-4 border-t border-border/30">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Cloud Sync</span>
          </div>
          <div className="space-y-2">
            <input
              type="password"
              value={syncToken}
              onChange={(e) => setSyncToken(e.target.value)}
              onBlur={handleSyncTokenBlur}
              placeholder="Enter sync token"
              className="w-full px-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-[10px] text-muted-foreground leading-tight">
              Enter your token to sync matches across devices. Your data will be stored in Cloudflare KV.
            </p>
          </div>
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
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-secondary hover:bg-secondary/80'
            }`}
          >
            <span className="text-foreground font-medium">Show debug overlay</span>
            <div
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.debug ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  settings.debug ? 'translate-x-6' : 'translate-x-0.5'
                } mt-0.5`}
              />
            </div>
          </button>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Display viewport measurements and layout information during live matches.
          </p>
        </div>
      </div>
    </div>
  );
}
