// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Index from "./Index";
import type { MatchSummary, Season } from "@/types/match";

const summary: MatchSummary = {
  id: "remote-match",
  myTeamName: "Shared Team",
  opponentName: "Remote Opponent",
  isHome: true,
  myTeamScore: 2,
  opponentScore: 1,
  date: "1 Sep 2026",
  endedAt: 1,
};
const season: Season = {
  id: "remote-season",
  name: "Shared Season",
  startAt: 1,
  status: "active",
  matches: [summary],
  fullMatches: {},
};
const remoteState = {
  matches: [summary],
  fullMatches: {},
  seasons: { "remote-season": season },
  activeSeasonId: "remote-season",
  activeMatch: null,
  settings: { teamName: "Shared Team", players: ["Alice"], periodsCount: 4, periodDuration: 20 },
};
const response = (role: "editor" | "viewer", body = remoteState) =>
  new Response(JSON.stringify(body), { headers: { "X-Workspace-Role": role } });

describe("Index viewer access", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState({}, "", "/");
  });

  it("loads shared history read-only while keeping the viewer token and local theme", async () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({
        teamName: "Local Team",
        calendarUrl: "",
        calendarTeamName: "",
        players: [],
        periodsCount: 4,
        periodDuration: 20,
        syncToken: "viewer-token",
        theme: "dark",
        debug: false,
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue(response("viewer"));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<Index />);

    expect(await screen.findByText("Waiting for a live match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start new match/i })).not.toBeInTheDocument();
    fireEvent.click(container.querySelector(".lucide-history")!.closest("button")!);
    expect(await screen.findByText("Remote Opponent")).toBeInTheDocument();
    expect(screen.getAllByText(/Shared Season/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /delete match/i })).not.toBeInTheDocument();

    fireEvent.click(container.querySelector(".lucide-settings")!.closest("button")!);
    expect(await screen.findByRole("status")).toHaveTextContent("Viewer");
    expect(screen.getByPlaceholderText("Enter sync token")).toHaveValue("viewer-token");
    expect(screen.getByRole("button", { name: "Refresh workspace" })).toBeInTheDocument();
    expect(screen.getByText("Dark").closest("button")).toHaveClass("border-primary");
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false),
    );
  });

  it("validates an imported view link, removes its fragment, and preserves a confirmed editor token", async () => {
    history.replaceState({}, "", "/#viewer=shared-viewer");
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({
        teamName: "Local Team",
        calendarUrl: "",
        calendarTeamName: "",
        players: [],
        periodsCount: 4,
        periodDuration: 20,
        syncToken: "saved-editor",
        theme: "system",
        debug: false,
      }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("viewer"))
      .mockResolvedValueOnce(response("editor"))
      .mockResolvedValue(response("editor"));
    vi.stubGlobal("fetch", fetchMock);
    render(<Index />);

    expect(await screen.findByRole("button", { name: /start new match/i })).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(screen.queryByText("Waiting for a live match")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([, options]) => options.headers["x-auth-token"])).toEqual([
      "shared-viewer",
      "saved-editor",
      "saved-editor",
    ]);
  });

  it("removes an invalid link without replacing the saved credential or changing its local data", async () => {
    history.replaceState({}, "", "/#viewer=bad-link");
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({
        teamName: "Local Team",
        calendarUrl: "",
        calendarTeamName: "",
        players: [],
        periodsCount: 4,
        periodDuration: 20,
        syncToken: "saved-editor",
        theme: "system",
        debug: false,
      }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValue(response("editor"));
    vi.stubGlobal("fetch", fetchMock);
    render(<Index />);

    expect(await screen.findByRole("button", { name: /start new match/i })).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(JSON.parse(localStorage.getItem("football-tracker-settings")!).syncToken).toBe(
      "saved-editor",
    );
  });
});
