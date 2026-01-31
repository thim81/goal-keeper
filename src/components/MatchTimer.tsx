import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface MatchTimerProps {
  startedAt: number;
  periodsCount: number;
  periodDuration: number;
  isRunning: boolean;
  totalPausedTime: number;
  pausedAt?: number;
  currentPeriod: number;
}

export function MatchTimer({
  startedAt,
  periodsCount,
  periodDuration,
  isRunning,
  totalPausedTime,
  pausedAt,
  currentPeriod,
}: MatchTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const updateElapsed = () => {
      let currentElapsed = 0;
      if (isRunning) {
        currentElapsed = Math.floor((Date.now() - startedAt - totalPausedTime) / 1000);
      } else if (pausedAt) {
        currentElapsed = Math.floor((pausedAt - startedAt - totalPausedTime) / 1000);
      } else {
        // Not started yet or something else
        currentElapsed = Math.floor((Date.now() - startedAt - totalPausedTime) / 1000);
      }
      setElapsed(Math.max(0, currentElapsed));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startedAt, isRunning, totalPausedTime, pausedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

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
        <span className={`font-mono text-lg font-bold tabular-nums ${isRunning ? 'text-primary' : 'text-muted-foreground'}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
