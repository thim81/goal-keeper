// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSettings } from "@/hooks/useSettings";

describe("useSettings calendar settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds empty calendar defaults to older saved settings", async () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({ teamName: "Goal Keeper", players: [], periodsCount: 4, periodDuration: 20 }),
    );

    const { result } = renderHook(() => useSettings());

    await waitFor(() => expect(result.current.settings.teamName).toBe("Goal Keeper"));
    expect(result.current.settings.calendarUrl).toBe("");
    expect(result.current.settings.calendarTeamName).toBe("");
  });

  it("updates the subscription URL and calendar team name", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateCalendarSettings(" https://club.prosoccerdata.com/feed ", " IPU15 ");
    });

    expect(result.current.settings.calendarUrl).toBe("https://club.prosoccerdata.com/feed");
    expect(result.current.settings.calendarTeamName).toBe("IPU15");
  });

  it("fills calendar defaults when restoring an older synced settings object", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setAllSettingsState({
        teamName: "Goal Keeper",
        calendarUrl: "",
        calendarTeamName: "",
        players: [],
        periodsCount: 4,
        periodDuration: 20,
        theme: "system",
        debug: false,
      });
    });

    expect(result.current.settings.calendarUrl).toBe("");
    expect(result.current.settings.calendarTeamName).toBe("");
  });
});
