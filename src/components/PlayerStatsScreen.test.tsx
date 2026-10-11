// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerStatsScreen } from "./PlayerStatsScreen";
import type { SeasonPlayerStats } from "@/lib/seasons";

const players: SeasonPlayerStats[] = [
  { name: "Alice", goals: 3, assists: 0, yellowCards: 1, redCards: 0 },
  { name: "Bob", goals: 3, assists: 4, yellowCards: 0, redCards: 0 },
  { name: "Chris", goals: 2, assists: 1, yellowCards: 0, redCards: 1 },
  ...["Dana", "Eli", "Fran"].map((name) => ({
    name,
    goals: 1,
    assists: 1,
    yellowCards: 0,
    redCards: 0,
  })),
];

function renderScreen(stats = players) {
  const props = {
    seasons: [
      { id: "current", name: "2026-2027", status: "active" as const },
      { id: "previous", name: "2025-2026", status: "closed" as const },
    ],
    selectedSeasonId: "current",
    stats,
    hasActiveMatch: false,
    onSelectSeason: vi.fn(),
    onGoHome: vi.fn(),
    onOpenHistory: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  return { ...render(<PlayerStatsScreen {...props} />), props };
}

describe("PlayerStatsScreen", () => {
  it("shows complete rankings with shared ranks for tied totals", () => {
    renderScreen();
    const scorers = within(screen.getByRole("region", { name: "Scorers" })).getAllByRole(
      "listitem",
    );
    expect(scorers).toHaveLength(6);
    expect(scorers.map((row) => row.textContent)).toEqual([
      "1Alice3",
      "1Bob3",
      "3Chris2",
      "4Dana1",
      "4Eli1",
      "4Fran1",
    ]);
    const assists = within(screen.getByRole("region", { name: "Assists" })).getAllByRole(
      "listitem",
    );
    expect(assists).toHaveLength(5);
    expect(assists[0]).toHaveTextContent("1Bob4");
    expect(assists.map((row) => row.textContent)).not.toContain(expect.stringContaining("Alice"));
  });

  it("sorts the full player table without changing the rankings", () => {
    renderScreen();
    const table = screen.getByRole("table", { name: "Season player stats" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(5);
    const names = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getByRole("rowheader").textContent);
    expect(names()).toEqual(["Alice", "Bob", "Chris", "Dana", "Eli", "Fran"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Assists" }));
    expect(names()).toEqual(["Bob", "Chris", "Dana", "Eli", "Fran", "Alice"]);
    expect(screen.getByRole("button", { name: "Sort by Assists" }).closest("th")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    fireEvent.click(screen.getByRole("button", { name: "Sort by Assists" }));
    expect(names()).toEqual(["Alice", "Chris", "Dana", "Eli", "Fran", "Bob"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Player" }));
    expect(names()).toEqual(["Alice", "Bob", "Chris", "Dana", "Eli", "Fran"]);
    expect(
      within(screen.getByRole("region", { name: "Assists" })).getAllByRole("listitem")[0],
    ).toHaveTextContent("1Bob4");
  });

  it("allows season selection and navigation", () => {
    const { props } = renderScreen();
    fireEvent.change(screen.getByRole("combobox", { name: "Season" }), {
      target: { value: "previous" },
    });
    expect(props.onSelectSeason).toHaveBeenCalledWith("previous");
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(props.onOpenHistory).toHaveBeenCalledOnce();
    const homeButton = screen.getByRole("button", { name: "Home" });
    expect(homeButton).toHaveTextContent("Home");
    expect(
      within(homeButton.closest("header")!)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Settings", "History", "Home"]);
    fireEvent.click(homeButton);
    expect(props.onGoHome).toHaveBeenCalledOnce();
  });

  it("shows empty rankings and a player table empty state", () => {
    renderScreen([]);
    expect(screen.getByText("No goals recorded")).toBeInTheDocument();
    expect(screen.getByText("No assists recorded")).toBeInTheDocument();
    expect(screen.getByText("No player stats recorded for this season.")).toBeInTheDocument();
  });
});
