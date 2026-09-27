import { Button } from "@/components/ui/button";
import type { UpcomingMatch } from "@/lib/upcoming-matches";

interface MatchCountdownProps {
  match: UpcomingMatch;
  teamName: string;
  secondsRemaining: number;
  onStart?: () => void;
}

export function MatchCountdown({ match, teamName, secondsRemaining, onStart }: MatchCountdownProps) {
  const homeTeamName = match.isHome ? teamName : match.opponentName;
  const awayTeamName = match.isHome ? match.opponentName : teamName;

  return (
    <section
      aria-label={`${homeTeamName} - ${awayTeamName}`}
      className="w-full max-w-xs mt-2 mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-5 text-center shadow-lg"
    >
      <h3 className="text-sm font-semibold text-muted-foreground">
        {new Date(match.start).toLocaleDateString("nl-BE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
        {" · "}
        {new Date(match.start).toLocaleTimeString("nl-BE", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </h3>
      <p className="mt-2 text-center text-xl font-bold text-foreground">
        {homeTeamName} <span className="text-muted-foreground">-</span> {awayTeamName}
      </p>
      {secondsRemaining > 0 ? (
        <p className="mt-3 flex items-baseline justify-center gap-2">
          <span className="text-sm text-muted-foreground">Start in: </span>
          <span className="font-mono text-lg font-bold tabular-nums text-primary">
            {Math.ceil(secondsRemaining / 60)} min
          </span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Waiting for the match to start</p>
      )}
      {onStart && (
        <Button type="button" onClick={onStart} className="mt-4 w-full">
          Start match
        </Button>
      )}
    </section>
  );
}
