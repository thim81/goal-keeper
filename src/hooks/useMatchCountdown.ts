import { useEffect, useState } from "react";
import {
  getUpcomingMatchCountdown,
  UPCOMING_MATCH_COUNTDOWN_GRACE_MS,
  UPCOMING_MATCH_COUNTDOWN_WINDOW_MS,
  type UpcomingMatch,
} from "@/lib/upcoming-matches";

const MAX_TIMEOUT_MS = 2_147_483_647;
const MINUTE_MS = 60_000;

export function useMatchCountdown(matches: UpcomingMatch[], enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || matches.length === 0) return;

    let timeout: number | null = null;
    let disposed = false;
    const clearTimeoutIfNeeded = () => {
      if (timeout !== null) window.clearTimeout(timeout);
      timeout = null;
    };
    const schedule = () => {
      clearTimeoutIfNeeded();
      if (disposed || document.visibilityState !== "visible") return;

      const currentTime = Date.now();
      setNow(currentTime);
      const next = matches
        .map((match) => ({ match, start: new Date(match.start).getTime() }))
        .filter(
          ({ start }) =>
            Number.isFinite(start) && start >= currentTime - UPCOMING_MATCH_COUNTDOWN_GRACE_MS,
        )
        .sort((a, b) => a.start - b.start)[0];
      if (!next) return;

      const countdownStartsAt = next.start - UPCOMING_MATCH_COUNTDOWN_WINDOW_MS;
      let delay = countdownStartsAt - currentTime;
      if (delay <= 0) {
        const untilMinute = MINUTE_MS - (currentTime % MINUTE_MS);
        const untilKickoff = next.start - currentTime;
        const untilGraceEnd = next.start + UPCOMING_MATCH_COUNTDOWN_GRACE_MS + 1 - currentTime;
        delay = Math.min(
          untilMinute,
          untilKickoff > 0 ? untilKickoff : Number.POSITIVE_INFINITY,
          untilGraceEnd,
        );
      }
      timeout = window.setTimeout(schedule, Math.min(Math.max(1, delay), MAX_TIMEOUT_MS));
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") schedule();
      else clearTimeoutIfNeeded();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      clearTimeoutIfNeeded();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, matches]);

  return enabled ? getUpcomingMatchCountdown(matches, now) : null;
}
