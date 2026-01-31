import { useState } from 'react';
import { ArrowLeft, Plus, X, Users, Clock, Shield } from 'lucide-react';
import { AppSettings } from '@/types/match';

interface SettingsScreenProps {
  settings: AppSettings;
  onBack: () => void;
  onUpdateTeamName: (name: string) => void;
  onAddPlayer: (name: string) => void;
  onRemovePlayer: (name: string) => void;
  onUpdatePeriods: (count: number, duration: number) => void;
}

export function SettingsScreen({
  settings,
  onBack,
  onUpdateTeamName,
  onAddPlayer,
  onRemovePlayer,
  onUpdatePeriods,
}: SettingsScreenProps) {
  const [newPlayer, setNewPlayer] = useState('');
  const [teamName, setTeamName] = useState(settings.teamName);

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

  return (
    <div className="flex flex-col h-full">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
      </div>
    </div>
  );
}
