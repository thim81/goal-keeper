import { useState, useEffect } from 'react';
import { X, Play, Home, Plane } from 'lucide-react';

interface StartMatchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMatch: (myTeamName: string, opponentName: string, isHome: boolean) => void;
  defaultTeamName?: string;
}

export function StartMatchSheet({
  isOpen,
  onClose,
  onStartMatch,
  defaultTeamName,
}: StartMatchSheetProps) {
  const [myTeamName, setMyTeamName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [isHome, setIsHome] = useState(true);

  // Update team name when sheet opens with default
  useEffect(() => {
    if (isOpen && defaultTeamName) {
      setMyTeamName(defaultTeamName);
    }
  }, [isOpen, defaultTeamName]);

  const handleSubmit = () => {
    onStartMatch(myTeamName.trim() || 'My Team', opponentName.trim() || 'Opponent', isHome);
    setMyTeamName('');
    setOpponentName('');
    setIsHome(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 animate-fade-in mb-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl border-t border-border/50 flex flex-col max-h-[92vh] animate-slide-up">
        {/* Handle */}
        <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-4 shrink-0" />

        <div className="flex-1 overflow-y-auto px-6 pb-10 safe-bottom">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">New Match ⚽</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* My Team */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Your Team Name
              </label>
              <input
                type="text"
                value={myTeamName}
                onChange={(e) => setMyTeamName(e.target.value)}
                placeholder="My Team"
                className="w-full px-4 py-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary text-lg"
                autoFocus
              />
            </div>

            {/* Opponent */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Opponent Name
              </label>
              <input
                type="text"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                placeholder="Opponent"
                className="w-full px-4 py-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary text-lg"
              />
            </div>

            {/* Home/Away Toggle */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Playing at
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsHome(true)}
                  className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    isHome
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary hover:border-primary/50'
                  }`}
                >
                  <Home className={`w-5 h-5 ${isHome ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span
                    className={`font-semibold ${isHome ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    Home
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsHome(false)}
                  className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    !isHome
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary hover:border-primary/50'
                  }`}
                >
                  <Plane
                    className={`w-5 h-5 ${!isHome ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span
                    className={`font-semibold ${!isHome ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    Away
                  </span>
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl hover:bg-primary/90 transition-colors btn-glow mt-4 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Kick Off!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
