// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Index from "./Index";
import type { Match, MatchSummary, Season } from "@/types/match";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
const activeMatch: Match = {
  id: "live-match",
  myTeamName: "Shared Team",
  opponentName: "Remote Opponent",
  isHome: true,
  goals: [],
  events: [],
  startedAt: 1,
  isActive: true,
  isRunning: false,
  totalPausedTime: 0,
  currentPeriod: 1,
};
const response = (role: "editor" | "viewer", body = remoteState) =>
  new Response(JSON.stringify(body), { headers: { "X-Workspace-Role": role } });

describe("Index viewer access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
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

    expect(await screen.findByText("Waiting for the next match")).toBeInTheDocument();
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

  it("hides sharing without an error when viewer access is not configured", async () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({
        teamName: "Shared Team",
        calendarUrl: "",
        calendarTeamName: "",
        players: [],
        periodsCount: 4,
        periodDuration: 20,
        syncToken: "editor-token",
        theme: "system",
        debug: false,
      }),
    );
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        url === "/api/share"
          ? new Response("Sharing not configured", { status: 503 })
          : response("editor"),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<Index />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /start new match/i })).toBeInTheDocument(),
    );
    fireEvent.click(container.querySelector(".lucide-settings")!.closest("button")!);
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url === "/api/share")).toBe(true),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Share link" })).not.toBeInTheDocument(),
    );
    expect(toast.error).not.toHaveBeenCalled();
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
    expect(screen.queryByText("Waiting for the next match")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([, options]) => options.headers["x-auth-token"])).toEqual([
      "shared-viewer",
      "saved-editor",
      "saved-editor",
    ]);
  });

  it("asks before a viewer link replaces local-only matches and keeps them when cancelled", async () => {
    history.replaceState({}, "", "/#viewer=shared-viewer");
    localStorage.setItem("football-tracker-seasons", JSON.stringify({ "remote-season": season }));
    localStorage.setItem("football-tracker-active-season-id", "remote-season");
    const fetchMock = vi.fn().mockResolvedValue(response("viewer"));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<Index />);

    expect(await screen.findByText("Replace local match data?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download backup" })).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("football-tracker-settings")!).syncToken).toBeFalsy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(container.querySelector(".lucide-history")!.closest("button")!);
    expect(await screen.findByText("Remote Opponent")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("offers a backup before replacing local matches with an empty viewer workspace", async () => {
    history.replaceState({}, "", "/#viewer=shared-viewer");
    localStorage.setItem("football-tracker-seasons", JSON.stringify({ "remote-season": season }));
    localStorage.setItem("football-tracker-active-season-id", "remote-season");
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:backup");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("viewer"))
      .mockResolvedValueOnce(
        new Response(null, { status: 204, headers: { "X-Workspace-Role": "viewer" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<Index />);

    expect(await screen.findByText("Replace local match data?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download backup" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem("football-tracker-settings")!).syncToken).toBeFalsy();
    fireEvent.click(screen.getByRole("button", { name: "Open view-only workspace" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(localStorage.getItem("football-tracker-settings")!).syncToken).toBe(
      "shared-viewer",
    );
    fireEvent.click(container.querySelector(".lucide-history")!.closest("button")!);
    expect(screen.queryByText("Remote Opponent")).not.toBeInTheDocument();
  });

  it("asks before a token entered in Settings replaces local-only matches", async () => {
    localStorage.setItem("football-tracker-seasons", JSON.stringify({ "remote-season": season }));
    localStorage.setItem("football-tracker-active-season-id", "remote-season");
    const fetchMock = vi.fn().mockResolvedValue(response("viewer"));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<Index />);

    fireEvent.click(container.querySelector(".lucide-settings")!.closest("button")!);
    const tokenInput = screen.getByPlaceholderText("Enter sync token");
    fireEvent.change(tokenInput, { target: { value: "shared-viewer" } });
    fireEvent.blur(tokenInput);
    expect(await screen.findByText("Replace local match data?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download backup" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tokenInput).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(JSON.parse(localStorage.getItem("football-tracker-settings")!).syncToken).toBeFalsy();
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("returns a viewer to home when the editor ends the active match", async () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({ ...remoteState.settings, syncToken: "viewer-token", theme: "system" }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("viewer", { ...remoteState, activeMatch }))
      .mockResolvedValueOnce(response("viewer", remoteState));
    vi.stubGlobal("fetch", fetchMock);
    render(<Index />);

    expect(await screen.findByText("⚽ Goal Keeper")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync match" }));

    expect(await screen.findByText("Waiting for the next match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("keeps viewer settings open when the editor ends the active match", async () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({ ...remoteState.settings, syncToken: "viewer-token", theme: "system" }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("viewer", { ...remoteState, activeMatch }))
      .mockResolvedValueOnce(response("viewer", remoteState));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<Index />);

    expect(await screen.findByText("⚽ Goal Keeper")).toBeInTheDocument();
    fireEvent.click(container.querySelector(".lucide-settings")!.closest("button")!);
    expect(await screen.findByText("Settings")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh workspace" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Team Name")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("shows the configured public calendar read-only for confirmed viewers", async () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({
        ...remoteState.settings,
        calendarUrl: "",
        calendarTeamName: "",
        syncToken: "viewer-token",
        theme: "system",
      }),
    );
    const calendarState = {
      ...remoteState,
      settings: {
        ...remoteState.settings,
        calendarUrl: "https://club.prosoccerdata.com/api/v2/members/ics/file?id=1&uuid=x",
        calendarTeamName: "",
      },
    };
    const calendarResponse = {
      games: [
        {
          id: "game|viewer",
          start: new Date(Date.now() + 86_400_000).toISOString(),
          homeTeam: "IPU15",
          awayTeam: "Opponent FC",
        },
      ],
    };
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === "/api/calendar") {
        return Promise.resolve(new Response(JSON.stringify(calendarResponse)));
      }
      return Promise.resolve(response("viewer", calendarState));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Index />);

    expect(await screen.findByText("Opponent FC")).toBeInTheDocument();
    expect(screen.getByText("Opponent FC").closest("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start new match/i })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("football-tracker-settings")!).calendarTeamName).toBe(
      "",
    );
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) => String(url) === "/api/state" && options?.method === "POST",
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Refresh upcoming matches" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/calendar")).toHaveLength(
        2,
      ),
    );
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) => String(url) === "/api/state" && options?.method === "POST",
      ),
    ).toBe(false);
  });

  it("replaces the viewer fixture list with a read-only countdown during the final hour", async () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({ ...remoteState.settings, syncToken: "viewer-token", theme: "system" }),
    );
    const calendarState = {
      ...remoteState,
      settings: {
        ...remoteState.settings,
        calendarUrl: "https://club.prosoccerdata.com/calendar.ics",
        calendarTeamName: "IPU15",
      },
    };
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === "/api/calendar") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              games: [
                {
                  id: "game|countdown-viewer",
                  start: new Date(Date.now() + 15 * 60_000).toISOString(),
                  homeTeam: "IPU15",
                  awayTeam: "Opponent FC",
                },
              ],
            }),
          ),
        );
      }
      return Promise.resolve(response("viewer", calendarState));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Index />);

    expect(await screen.findByText("Get ready for kickoff")).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: "Shared Team - Opponent FC" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Upcoming matches")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start match/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start new match/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start a different match" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Shared Team - Opponent FC" }).querySelector(".font-mono")
        ?.textContent,
    ).toMatch(/^\d+ min$/);
    const countdownCard = screen.getByRole("region", { name: "Shared Team - Opponent FC" });
    const refreshButton = screen.getByRole("button", { name: "Refresh" });
    expect(
      countdownCard.compareDocumentPosition(refreshButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens the existing start sheet with countdown fixture defaults for editors", async () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({ ...remoteState.settings, syncToken: "editor-token", theme: "system" }),
    );
    const calendarState = {
      ...remoteState,
      settings: {
        ...remoteState.settings,
        calendarUrl: "https://club.prosoccerdata.com/calendar.ics",
        calendarTeamName: "IPU15",
      },
    };
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === "/api/calendar") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              games: [
                {
                  id: "game|countdown-editor",
                  start: new Date(Date.now() + 15 * 60_000).toISOString(),
                  homeTeam: "IPU15",
                  awayTeam: "Opponent FC",
                },
              ],
            }),
          ),
        );
      }
      return Promise.resolve(response("editor", calendarState));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Index />);

    fireEvent.click(await screen.findByRole("button", { name: "Start match" }));
    expect(screen.getByText("New Match ⚽")).toBeInTheDocument();
    expect(screen.queryByText("Upcoming matches")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Opponent")).toHaveValue("Opponent FC");
    expect(screen.getByRole("button", { name: "Home" })).toHaveClass("border-primary");

    const closeButton = screen.getByText("New Match ⚽").parentElement?.querySelector("button");
    fireEvent.click(closeButton!);
    fireEvent.click(screen.getByRole("button", { name: "Start a different match" }));
    expect(screen.getByPlaceholderText("Opponent")).toHaveValue("");
  });

  it("keeps editor match actions available after a transient autosave failure", async () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({ ...remoteState.settings, syncToken: "editor-token", theme: "system" }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("editor"))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Index />);

    fireEvent.click(await screen.findByRole("button", { name: "Start New Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Kick Off!" }));
    await screen.findByRole("button", { name: "We Scored!" });

    await waitFor(
      () =>
        expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(true),
      { timeout: 4000 },
    );
    fireEvent.click(screen.getByRole("button", { name: "We Scored!" }));
    expect(screen.getByText("Add Goal ⚽")).toBeInTheDocument();
  });
});
