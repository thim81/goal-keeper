import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface MatchTimerProps {
  startedAt: number;
  periodsCount: number;
  periodDuration: number;
}

export function MatchTimer({ startedAt, periodsCount, periodDuration }: MatchTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const totalMatchMinutes = periodsCount * periodDuration;
  const currentPeriod = Math.min(Math.floor(minutes / periodDuration) + 1, periodsCount);

  // Start time
  const startTime = new Date(startedAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3 mt-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Started {startTime}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
          Period {currentPeriod}/{periodsCount}
        </span>
        <span className="font-mono text-lg font-bold text-primary tabular-nums">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
