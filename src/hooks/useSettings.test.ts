// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettings } from "@/hooks/useSettings";
import { createEmptyWorkspace } from "@/lib/workspace";
import { emptyMetadata, saveWorkspaceCache } from "@/lib/workspace-cache";

describe("useSettings state and persistence", () => {
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

  it("restores cached shared settings while preserving device credentials and theme", () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({ teamName: "Old", syncToken: "device-token", theme: "dark" }),
    );
    const state = createEmptyWorkspace();
    state.settings.teamName = "Cached team";
    state.settings.players = ["Alex"];
    saveWorkspaceCache({
      state,
      credential: "device-token",
      workspaceId: "test",
      role: "editor",
      metadata: emptyMetadata(),
    });
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toMatchObject({
      teamName: "Cached team",
      players: ["Alex"],
      theme: "dark",
      syncToken: "device-token",
    });
  });

  it("remains usable when browser persistence is unavailable", () => {
    const save = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    try {
      const { result } = renderHook(() => useSettings());
      act(() =>
        result.current.setAllSettingsState({ ...result.current.settings, teamName: "Local team" }),
      );
      expect(result.current.settings.teamName).toBe("Local team");
    } finally {
      save.mockRestore();
    }
  });

  it.each([{ syncToken: 123 }, { players: "broken", syncToken: "valid-token", theme: "dark" }])(
    "recovers from malformed saved settings while preserving valid device preferences",
    (saved) => {
      localStorage.setItem("football-tracker-settings", JSON.stringify(saved));
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.players).toEqual([]);
      expect(typeof (result.current.settings.syncToken ?? "")).toBe("string");
      if (saved.syncToken === "valid-token")
        expect(result.current.settings).toMatchObject({ syncToken: "valid-token", theme: "dark" });
    },
  );

  it.each(["new-token", ""])(
    "does not restore another credential's cached settings (%s)",
    (token) => {
      localStorage.setItem(
        "football-tracker-settings",
        JSON.stringify({ teamName: "Current team", syncToken: token, theme: "dark" }),
      );
      const state = createEmptyWorkspace();
      state.settings.teamName = "Previous workspace";
      saveWorkspaceCache({
        state,
        credential: "old-token",
        workspaceId: "old",
        role: "editor",
        metadata: emptyMetadata(),
      });
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings).toMatchObject({
        teamName: "Current team",
        syncToken: token,
        theme: "dark",
      });
      expect(JSON.parse(localStorage.getItem("football-tracker-settings")!).teamName).toBe(
        "Current team",
      );
    },
  );

  it("persists device credentials and theme updates", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSyncToken("device-token");
      result.current.updateTheme("dark");
    });

    expect(result.current.settings).toMatchObject({ syncToken: "device-token", theme: "dark" });
    expect(JSON.parse(localStorage.getItem("football-tracker-settings")!)).toEqual(
      result.current.settings,
    );
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
