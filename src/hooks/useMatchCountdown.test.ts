// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMatchCountdown } from "./useMatchCountdown";
import type { UpcomingMatch } from "@/lib/upcoming-matches";

describe("useMatchCountdown", () => {
  afterEach(() => vi.useRealTimers());

  it("sleeps for distant fixtures, then updates at minute boundaries", () => {
    vi.useFakeTimers();
    const now = new Date("2026-09-27T10:00:00.000Z");
    vi.setSystemTime(now);
    const match: UpcomingMatch = {
      id: "distant",
      start: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      homeTeam: "Home",
      awayTeam: "Away",
      opponentName: "Away",
      isHome: true,
    };
    const renderSpy = vi.fn();
    const { result, unmount } = renderHook(() => {
      renderSpy();
      return useMatchCountdown([match], true);
    });
    const rendersWhileWaiting = renderSpy.mock.calls.length;
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(30 * 60 * 1000));
    expect(renderSpy).toHaveBeenCalledTimes(rendersWhileWaiting);
    expect(result.current).toBeNull();

    act(() => vi.advanceTimersByTime(30 * 60 * 1000));
    expect(result.current?.secondsRemaining).toBe(3600);
    act(() => vi.advanceTimersByTime(60 * 1000));
    expect(result.current?.secondsRemaining).toBe(3540);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
