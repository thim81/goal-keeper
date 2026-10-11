// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Index from "./Index";
import { createEmptyWorkspace } from "@/lib/workspace";
import { applyWorkspaceCommand } from "@/lib/workspace-mutations";
import type { Match, MatchSummary, Season } from "@/types/match";

function goToHistory(container: HTMLElement) {
  fireEvent.click(container.querySelector(".lucide-history")!.closest("button")!);
}

function goToSettings(container: HTMLElement) {
  fireEvent.click(container.querySelector(".lucide-settings")!.closest("button")!);
}

function swipe(element: Element, distance: number) {
  fireEvent.pointerDown(element, { clientX: 0 });
  fireEvent.pointerMove(element, { clientX: distance });
  fireEvent.pointerUp(element);
}

function seedOneMatchSeason() {
  const seasonId = "season-1";
  const matchId = "match-1";
  const summary: MatchSummary = {
    id: matchId,
    myTeamName: "My Team",
    opponentName: "Rivals",
    isHome: true,
    myTeamScore: 2,
    opponentScore: 1,
    date: "1 Apr 2026",
    endedAt: 1,
  };
  const fullMatch: Match = {
    id: matchId,
    myTeamName: "My Team",
    opponentName: "Rivals",
    isHome: true,
    goals: [],
    events: [],
    startedAt: 1,
    endedAt: 1,
    isActive: false,
    isRunning: false,
    totalPausedTime: 0,
    currentPeriod: 1,
  };
  const season: Season = {
    id: seasonId,
    name: "2025-2026",
    startAt: 1,
    status: "active",
    matches: [summary],
    fullMatches: { [matchId]: fullMatch },
  };
  localStorage.setItem("football-tracker-seasons", JSON.stringify({ [seasonId]: season }));
  localStorage.setItem("football-tracker-active-season-id", seasonId);
  return { seasonId, matchId };
}

async function startMatchAndReachFinalPeriodEnd() {
  render(<Index />);

  fireEvent.click(await screen.findByRole("button", { name: /start new match/i }));
  fireEvent.change(screen.getByPlaceholderText("Opponent"), { target: { value: "Rivals" } });
  fireEvent.click(screen.getByRole("button", { name: /kick off/i }));
  await screen.findByText("⚽ Goal Keeper");

  // Default settings.periodsCount is 4; walk through periods 1-3 to reach the final one.
  for (const period of [1, 2, 3]) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`end period ${period}`, "i") }));
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`start period ${period + 1}`, "i") }),
    );
  }

  fireEvent.click(screen.getByRole("button", { name: /end period 4/i }));
}

describe("Index match flow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares the season selection between player stats and match history", () => {
    const { seasonId, matchId } = seedOneMatchSeason();
    const seasons = JSON.parse(localStorage.getItem("football-tracker-seasons")!) as Record<
      string,
      Season
    >;
    const goal = (scorer: string) => ({
      id: scorer,
      scorer,
      type: "normal" as const,
      team: "my-team" as const,
      time: "10:00",
      timestamp: 1,
    });
    seasons[seasonId].fullMatches[matchId].goals = [goal("Alice")];
    const previous: Season = {
      ...seasons[seasonId],
      id: "previous",
      name: "2024-2025",
      status: "closed",
      fullMatches: {
        [matchId]: { ...seasons[seasonId].fullMatches[matchId], goals: [goal("Dana")] },
      },
    };
    localStorage.setItem("football-tracker-seasons", JSON.stringify({ ...seasons, previous }));
    render(<Index />);

    fireEvent.click(screen.getByRole("button", { name: "Player stats" }));
    expect(screen.getByRole("heading", { name: "Player Stats" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Alice" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Season" }), {
      target: { value: "previous" },
    });
    expect(screen.getByRole("rowheader", { name: "Dana" })).toBeInTheDocument();
    expect(screen.queryByRole("rowheader", { name: "Alice" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByRole("heading", { name: "Match History" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Season" })).toHaveValue("previous");
  });

  it.each(["goal", "card", "edited-goal", "start"] as const)(
    "Undo deletes the latest displayed timeline entry (%s)",
    async (kind) => {
      const startedAt = Date.now() - 10_000;
      const match: Match = {
        id: "live",
        myTeamName: "My Team",
        opponentName: "Rivals",
        isHome: true,
        goals:
          kind === "start"
            ? []
            : [
                {
                  id: "alice",
                  team: "my-team",
                  scorer: "Alice",
                  type: "normal",
                  time: "13:00",
                  timestamp: startedAt + (kind === "edited-goal" ? 3000 : 1000),
                },
                {
                  id: "bob",
                  team: "my-team",
                  scorer: "Bob",
                  type: "normal",
                  time: "13:01",
                  timestamp: startedAt + 2000,
                },
              ],
        events: [
          { id: "start", type: "start", time: "13:00", timestamp: startedAt },
          ...(kind === "card"
            ? [
                {
                  id: "card",
                  type: "yellow-card" as const,
                  time: "13:02",
                  timestamp: startedAt + 3000,
                },
              ]
            : []),
        ],
        startedAt,
        isActive: true,
        isRunning: true,
        totalPausedTime: 0,
        currentPeriod: 1,
      };
      localStorage.setItem("football-tracker-active-match", JSON.stringify(match));
      render(<Index />);
      fireEvent.click(await screen.findByRole("button", { name: /show extra actions/i }));
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      const saved = JSON.parse(localStorage.getItem("football-tracker-active-match")!);
      const deletedId = kind === "edited-goal" ? "alice" : kind === "goal" ? "bob" : kind;
      expect(saved.goals).toEqual(match.goals.filter((goal) => goal.id !== deletedId));
      expect(saved.events).toEqual(match.events.filter((event) => event.id !== deletedId));
      expect(saved.id).toBe(match.id);
      expect(saved.startedAt).toBe(match.startedAt);
      if (kind === "start") expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    },
  );

  it.each([
    ["Pause Timer", true],
    ["Pause Timer", false],
    ["Resume Timer", true],
    ["Resume Timer", false],
  ])("toggles the timer from %s when running is %s", async (button, isRunning) => {
    const startedAt = Date.now() - 10_000;
    const match: Match = {
      id: "live",
      myTeamName: "My Team",
      opponentName: "Rivals",
      isHome: true,
      goals: [{ id: "goal", team: "my-team", type: "normal", time: "13:00", timestamp: startedAt }],
      events: [{ id: "start", type: "start", time: "13:00", timestamp: startedAt }],
      startedAt,
      isActive: true,
      isRunning,
      pausedAt: isRunning ? undefined : startedAt + 5000,
      totalPausedTime: 0,
      currentPeriod: 1,
      periodStartedAt: startedAt,
      periodPausedTime: 0,
    };
    localStorage.setItem("football-tracker-active-match", JSON.stringify(match));
    render(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /show extra actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /^event$/i }));
    fireEvent.click(screen.getByRole("button", { name: button as string }));
    await waitFor(() => expect(screen.queryByText("Add Event 📋")).not.toBeInTheDocument());
    const saved = JSON.parse(localStorage.getItem("football-tracker-active-match")!);
    expect(saved.isRunning).toBe(!isRunning);
    expect(saved.goals).toEqual(match.goals);
    expect(saved.events).toEqual(match.events);
    expect(saved.startedAt).toBe(startedAt);
  });

  it.each([false, true])(
    "closes sheets and queues rapid goals, with first save rejected: %s",
    async (rejectFirst) => {
      let server = applyWorkspaceCommand(createEmptyWorkspace(100), {
        id: "start",
        type: "start-match",
        payload: { myTeamName: "My Team", opponentName: "Rivals", isHome: true },
      }).state;
      localStorage.setItem("football-tracker-settings", JSON.stringify({ syncToken: "editor" }));
      let finishFirst!: () => void;
      const commands: any[] = [];
      let revision = 1;
      const reply = (body: unknown) =>
        new Response(JSON.stringify(body), { headers: { "X-Workspace-Role": "editor" } });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, options?: RequestInit) => {
          if (url === "/api/command") {
            const command = JSON.parse(options!.body as string);
            commands.push(command);
            if (commands.length === 1) {
              await new Promise<void>((resolve) => {
                finishFirst = resolve;
              });
              if (rejectFirst) return new Response("Goal rejected", { status: 409 });
            }
            server = applyWorkspaceCommand(server, command).state;
            return reply({
              scope: "live",
              workspaceId: "goal-keeper",
              revision: ++revision,
              structureRevision: 1,
              commandId: command.id,
              activeMatch: server.activeMatch,
              activeSeasonId: server.activeSeasonId,
            });
          }
          return reply({
            scope: "structural",
            workspaceId: "goal-keeper",
            revision,
            structureRevision: 1,
            state: server,
          });
        }),
      );
      render(<Index />);
      await screen.findByText("⚽ Goal Keeper");
      for (const scorer of ["Alice", "Bob"]) {
        fireEvent.click(screen.getByRole("button", { name: /we scored!/i }));
        fireEvent.change(screen.getByPlaceholderText("Who scored?"), { target: { value: scorer } });
        fireEvent.click(screen.getByRole("button", { name: /^add goal$/i }));
        await waitFor(() =>
          expect(screen.queryByPlaceholderText("Who scored?")).not.toBeInTheDocument(),
        );
        expect(screen.queryByText(/Saving/)).not.toBeInTheDocument();
      }
      expect(commands).toHaveLength(1);
      expect(server.activeMatch!.goals).toHaveLength(0);
      await act(async () => {
        finishFirst();
      });
      await waitFor(() => expect(commands).toHaveLength(2));
      await waitFor(() => {
        const saved = JSON.parse(localStorage.getItem("football-tracker-active-match")!);
        expect(saved.goals.map((goal: any) => goal.scorer)).toEqual(
          rejectFirst ? ["Bob"] : ["Alice", "Bob"],
        );
      });
      expect(commands[0].id).not.toBe(commands[1].id);
      expect(screen.queryByText("Goal rejected")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /retry action/i })).not.toBeInTheDocument();
    },
  );

  it("starts a match, scores a goal, ends it, and shows the result on home", async () => {
    render(<Index />);

    fireEvent.click(await screen.findByRole("button", { name: /start new match/i }));

    fireEvent.change(screen.getByPlaceholderText("Opponent"), {
      target: { value: "Rivals" },
    });
    fireEvent.click(screen.getByRole("button", { name: /kick off/i }));

    await screen.findByText("⚽ Goal Keeper");

    fireEvent.click(screen.getByRole("button", { name: /we scored!/i }));
    fireEvent.change(screen.getByPlaceholderText("Who scored?"), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add goal$/i }));

    fireEvent.click(screen.getByRole("button", { name: /show extra actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /^end$/i }));

    const resultCard = await screen.findByText("Rivals");
    expect(resultCard.closest("button")).toHaveTextContent("WIN");
    expect(resultCard.closest("button")).toHaveTextContent("1");
  });

  it.each([false, true])(
    "waits for the end-match reply without overriding navigation, history opened: %s",
    async (openHistory) => {
      let server = applyWorkspaceCommand(createEmptyWorkspace(), {
        id: "start",
        type: "start-match",
        payload: { myTeamName: "My Team", opponentName: "Rivals", isHome: true },
      }).state;
      localStorage.setItem("football-tracker-settings", JSON.stringify({ syncToken: "editor" }));
      let finishEnd!: () => void;
      let revision = 1;
      const commands: any[] = [];
      const reply = (body: unknown) =>
        new Response(JSON.stringify(body), { headers: { "X-Workspace-Role": "editor" } });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, options?: RequestInit) => {
          if (url === "/api/command") {
            const command = JSON.parse(options!.body as string);
            commands.push(command);
            await new Promise<void>((resolve) => {
              finishEnd = resolve;
            });
            server = applyWorkspaceCommand(server, command).state;
            revision++;
            return reply({
              scope: "structural",
              workspaceId: "goal-keeper",
              revision,
              structureRevision: revision,
              commandId: command.id,
              state: server,
            });
          }
          return reply({
            scope: "structural",
            workspaceId: "goal-keeper",
            revision,
            structureRevision: revision,
            state: server,
          });
        }),
      );
      const { container } = render(<Index />);
      await screen.findByText("⚽ Goal Keeper");
      fireEvent.click(screen.getByRole("button", { name: /show extra actions/i }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^end$/i }));
        if (openHistory) goToHistory(container);
      });
      expect(commands.map((command) => command.type)).toEqual(["end-match"]);
      expect(server.activeMatch).not.toBeNull();
      expect(screen.queryByText("Ready to Play?")).not.toBeInTheDocument();
      if (openHistory) expect(screen.getByText("No matches yet")).toBeInTheDocument();
      else expect(screen.getByText("⚽ Goal Keeper")).toBeInTheDocument();
      await act(async () => {
        finishEnd();
      });
      if (!openHistory) await screen.findByText("Ready to Play?");
      const result = await screen.findByText("Rivals");
      expect(result.closest("button")).toHaveTextContent("DRAW");
      expect(server.activeMatch).toBeNull();
      expect(server.matches).toHaveLength(1);
    },
  );

  it("prefills and starts a match selected from the upcoming calendar list", async () => {
    localStorage.setItem(
      "football-tracker-settings",
      JSON.stringify({
        teamName: "My Team",
        calendarUrl: "https://club.prosoccerdata.com/api/v2/members/ics/file?id=1&uuid=x",
        calendarTeamName: "My Team",
        players: [],
        periodsCount: 4,
        periodDuration: 20,
        theme: "system",
        debug: false,
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            games: [
              {
                id: "game|1",
                start: new Date(Date.now() + 86_400_000).toISOString(),
                homeTeam: "Rivals FC",
                awayTeam: "My Team",
              },
            ],
          }),
        ),
      ),
    );

    render(<Index />);

    fireEvent.click(await screen.findByText("Rivals FC"));

    const opponentInput = await screen.findByPlaceholderText("Opponent");
    await waitFor(() => expect(opponentInput).toHaveValue("Rivals FC"));

    fireEvent.click(screen.getByRole("button", { name: /kick off/i }));

    await screen.findByText("⚽ Goal Keeper");
    expect(screen.getAllByText("Rivals FC").length).toBeGreaterThan(0);
  });

  it("lets the user continue playing from the final-whistle prompt instead of ending the match", async () => {
    await startMatchAndReachFinalPeriodEnd();

    await screen.findByText("Final whistle?");
    fireEvent.click(screen.getByRole("button", { name: /continue game/i }));

    await waitFor(() => expect(screen.queryByText("Final whistle?")).not.toBeInTheDocument());
    expect(screen.getByText("⚽ Goal Keeper")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start period 5/i })).toBeInTheDocument();
  });

  it("archives the match when confirming End Match from the final-whistle prompt", async () => {
    await startMatchAndReachFinalPeriodEnd();

    await screen.findByText("Final whistle?");
    fireEvent.click(screen.getByRole("button", { name: /^end match$/i }));

    await screen.findByText("Ready to Play?");
    expect(screen.queryByText("Final whistle?")).not.toBeInTheDocument();
  });
});

describe("Index history interactions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("deletes a match after confirming the delete dialog", async () => {
    seedOneMatchSeason();
    const { container } = render(<Index />);
    goToHistory(container);

    swipe(await screen.findByText("Rivals"), -60);
    fireEvent.click(screen.getByRole("button", { name: /delete match/i }));

    await screen.findByText("Delete match?");
    fireEvent.click(screen.getByRole("button", { name: /^delete match$/i }));

    await screen.findByText("No matches yet");
  });

  it("keeps the match when the delete dialog is cancelled", async () => {
    seedOneMatchSeason();
    const { container } = render(<Index />);
    goToHistory(container);

    swipe(await screen.findByText("Rivals"), -60);
    fireEvent.click(screen.getByRole("button", { name: /delete match/i }));

    await screen.findByText("Delete match?");
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => expect(screen.queryByText("Delete match?")).not.toBeInTheDocument());
    expect(screen.getByText("Rivals")).toBeInTheDocument();
  });
});

describe("Index season dialog interactions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("closes the active season and lets the user reopen it afterward", async () => {
    seedOneMatchSeason();
    const { container } = render(<Index />);
    goToHistory(container);

    fireEvent.click(screen.getByTitle("Close season and start new"));
    await screen.findByText("Close Season");
    fireEvent.click(screen.getByRole("button", { name: /close & start new/i }));

    await screen.findByText("Ready to Play?");

    goToHistory(container);
    const reopenButton = await screen.findByTitle("Reopen this season");
    fireEvent.click(reopenButton);

    await screen.findByText("Reopen this season?");
    fireEvent.click(screen.getByRole("button", { name: /^reopen season$/i }));

    await waitFor(() => expect(screen.queryByTitle("Reopen this season")).not.toBeInTheDocument());
    expect(screen.getByTitle("Long press to rename season")).toHaveTextContent(
      "2025-2026 (Active)",
    );
  });

  it("renames a season via long press on its label", async () => {
    seedOneMatchSeason();
    vi.useFakeTimers();
    const { container } = render(<Index />);
    goToHistory(container);

    const seasonLabel = screen.getByTitle("Long press to rename season");
    fireEvent.pointerDown(seasonLabel);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const nameInput = screen.getByPlaceholderText("Season name");
    fireEvent.change(nameInput, { target: { value: "Playoffs" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByTitle("Long press to rename season")).toHaveTextContent("Playoffs (Active)");
  });

  it("exports a backup containing the current settings and season data", async () => {
    seedOneMatchSeason();
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const { container } = render(<Index />);
    goToSettings(container);

    fireEvent.click(screen.getByText("Export"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const payload = JSON.parse(await blob.text());

    expect(payload.version).toBe(1);
    expect(payload.state.settings.teamName).toBe("My Team");
    expect(payload.state.seasons["season-1"].matches).toHaveLength(1);
  });

  it("imports a backup and applies its settings and seasons", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { container } = render(<Index />);
    goToSettings(container);

    const backup = {
      version: 1,
      exportedAt: new Date(0).toISOString(),
      state: {
        matches: [],
        fullMatches: {},
        activeMatch: null,
        seasons: {
          "imported-season": {
            id: "imported-season",
            name: "Imported Season",
            startAt: 1,
            status: "active",
            matches: [],
            fullMatches: {},
          },
        },
        activeSeasonId: "imported-season",
        settings: {
          teamName: "Imported Team",
          calendarUrl: "",
          calendarTeamName: "",
          players: [],
          periodsCount: 4,
          periodDuration: 20,
          theme: "system",
          debug: false,
        },
      },
    };
    const file = new File([JSON.stringify(backup)], "backup.json", { type: "application/json" });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByText("Ready to Play?");

    goToSettings(container);
    expect(screen.getByPlaceholderText("Enter your team name")).toHaveValue("Imported Team");
    expect(confirm).not.toHaveBeenCalled();
  });
});
