import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchHistoryScreen } from "./MatchHistoryScreen";
import type { SeasonStats } from "@/lib/seasons";
import type { MatchSummary } from "@/types/match";

const seasons = [
  { id: "season-1", name: "2025-2026", status: "active" as const },
  { id: "season-2", name: "2024-2025", status: "closed" as const },
];

const stats: SeasonStats = {
  matches: 1,
  wins: 1,
  draws: 0,
  losses: 0,
  goalsFor: 2,
  goalsAgainst: 1,
  topScorers: ["Alice"],
  topScorerGoals: 2,
  topAssisters: [],
  topAssists: 0,
};

const matches: MatchSummary[] = [
  {
    id: "match-1",
    myTeamName: "My Team",
    opponentName: "Rivals",
    isHome: true,
    myTeamScore: 2,
    opponentScore: 1,
    date: "1 Apr 2026",
    endedAt: 1,
  },
];

function renderScreen(overrides: Partial<React.ComponentProps<typeof MatchHistoryScreen>> = {}) {
  const props: React.ComponentProps<typeof MatchHistoryScreen> = {
    seasons,
    selectedSeasonId: "season-1",
    selectedSeason: seasons[0],
    matches,
    stats,
    activeSeasonStats: stats,
    canEdit: true,
    canCloseSeason: true,
    canReopenSeason: true,
    hasActiveMatch: false,
    onSelectSeason: vi.fn(),
    onSelectMatch: vi.fn(),
    onOpenSettings: vi.fn(),
    onGoHome: vi.fn(),
    onCloseSeason: vi.fn(() => true),
    onReopenSeason: vi.fn(() => true),
    onRenameSeason: vi.fn(() => true),
    ...overrides,
  };
  return { ...render(<MatchHistoryScreen {...props} />), props };
}

describe("MatchHistoryScreen", () => {
  afterEach(() => vi.useRealTimers());

  it("shows the season stats and the past matches heading before the match list", () => {
    renderScreen();

    expect(screen.getByText("Goal Balance")).toBeInTheDocument();
    expect(screen.getByText("Past Matches")).toBeInTheDocument();
    expect(screen.getByText("Rivals")).toBeInTheDocument();
  });

  it("reports season and match selections", () => {
    const { props } = renderScreen();

    fireEvent.change(screen.getByLabelText("Season"), { target: { value: "season-2" } });
    fireEvent.click(screen.getByText("Rivals"));

    expect(props.onSelectSeason).toHaveBeenCalledWith("season-2");
    expect(props.onSelectMatch).toHaveBeenCalledWith("match-1");
  });

  it("opens rename after a long press and saves through the season callback", () => {
    vi.useFakeTimers();
    const { props } = renderScreen();
    const seasonName = screen.getByTitle("Long press to rename season");

    fireEvent.pointerDown(seasonName);
    act(() => vi.advanceTimersByTime(500));

    expect(screen.getByText("Rename Season")).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText("Season name");
    expect(nameInput).toHaveValue("2025-2026");
    fireEvent.change(nameInput, { target: { value: "Playoffs" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(props.onRenameSeason).toHaveBeenCalledWith("season-1", "Playoffs");
    fireEvent.pointerUp(seasonName);
    expect(fireEvent.click(seasonName)).toBe(false);
  });

  it("offers a reopen action for a closed season", () => {
    const { props } = renderScreen({ selectedSeason: seasons[1] });

    fireEvent.click(screen.getByTitle("Reopen this season"));
    fireEvent.click(screen.getByRole("button", { name: /^reopen season$/i }));

    expect(props.onReopenSeason).toHaveBeenCalledWith("season-2");
  });
});
