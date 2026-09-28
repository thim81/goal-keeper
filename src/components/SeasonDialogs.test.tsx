import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeasonDialogs } from "./SeasonDialogs";
import type { SeasonStats } from "@/lib/seasons";

const stats: SeasonStats = {
  matches: 4,
  wins: 2,
  draws: 1,
  losses: 1,
  goalsFor: 8,
  goalsAgainst: 6,
  topScorer: "Alice",
  topScorerGoals: 4,
  topAssister: null,
  topAssists: 0,
};

function renderDialogs(overrides: Partial<React.ComponentProps<typeof SeasonDialogs>> = {}) {
  const props: React.ComponentProps<typeof SeasonDialogs> = {
    canEdit: true,
    canCloseSeason: true,
    canReopenSeason: true,
    activeSeasonStats: stats,
    selectedSeason: { id: "season-1", name: "2025-2026", status: "active" },
    onCloseSeason: vi.fn(() => true),
    onReopenSeason: vi.fn(() => true),
    onRenameSeason: vi.fn(() => true),
    children: ({ openCloseSeason, openReopenSeason, openRenameSeason }) => (
      <div>
        <button onClick={openCloseSeason}>Open close season</button>
        <button onClick={() => openReopenSeason("season-2")}>Open reopen season</button>
        <button onClick={openRenameSeason}>Open rename season</button>
      </div>
    ),
    ...overrides,
  };
  return { ...render(<SeasonDialogs {...props} />), props };
}

describe("SeasonDialogs", () => {
  it("shows the season summary and confirms closing the season", () => {
    const { props } = renderDialogs();

    fireEvent.click(screen.getByRole("button", { name: "Open close season" }));
    expect(screen.getByText("Close Season")).toBeInTheDocument();
    expect(screen.getByText("Goal Balance")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Season name"), {
      target: { value: "2027-2028" },
    });
    fireEvent.click(screen.getByRole("button", { name: /close & start new/i }));

    expect(props.onCloseSeason).toHaveBeenCalledWith("2027-2028");
  });

  it("confirms reopening the selected season", () => {
    const { props } = renderDialogs();

    fireEvent.click(screen.getByRole("button", { name: "Open reopen season" }));
    expect(screen.getByText("Reopen this season?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^reopen season$/i }));

    expect(props.onReopenSeason).toHaveBeenCalledWith("season-2");
  });

  it("keeps the reopen dialog open when reopening fails", () => {
    renderDialogs({ onReopenSeason: vi.fn(() => false) });

    fireEvent.click(screen.getByRole("button", { name: "Open reopen season" }));
    fireEvent.click(screen.getByRole("button", { name: /^reopen season$/i }));

    expect(screen.getByText("Reopen this season?")).toBeInTheDocument();
  });

  it("resets open dialogs when edit rights are removed", () => {
    const { rerender, props } = renderDialogs();

    fireEvent.click(screen.getByRole("button", { name: "Open close season" }));
    rerender(<SeasonDialogs {...props} canEdit={false} />);
    rerender(<SeasonDialogs {...props} canEdit />);

    expect(screen.queryByText("Close Season")).not.toBeInTheDocument();
  });

  it("reports when reopening is unavailable during an active match", () => {
    renderDialogs({ canReopenSeason: false });
    fireEvent.click(screen.getByRole("button", { name: "Open reopen season" }));

    expect(
      screen.getByText("Finish the active match before reopening a season."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reopen season$/i })).toBeDisabled();
  });

  it("saves the season name draft", () => {
    const { props } = renderDialogs();

    fireEvent.click(screen.getByRole("button", { name: "Open rename season" }));
    fireEvent.change(screen.getByPlaceholderText("Season name"), {
      target: { value: "Playoffs" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(props.onRenameSeason).toHaveBeenCalledWith("season-1", "Playoffs");
  });
});
