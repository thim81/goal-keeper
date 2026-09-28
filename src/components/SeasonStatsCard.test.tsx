import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeasonStatsCard } from "./SeasonStatsCard";
import type { SeasonStats } from "@/lib/seasons";

const stats: SeasonStats = {
  matches: 8,
  wins: 5,
  draws: 2,
  losses: 1,
  goalsFor: 18,
  goalsAgainst: 9,
  topScorers: ["Alice"],
  topScorerGoals: 8,
  topAssisters: ["Dana"],
  topAssists: 7,
};

describe("SeasonStatsCard", () => {
  it("shows the record, goal balance, scorer, and assist leader", () => {
    render(<SeasonStatsCard stats={stats} />);

    expect(screen.getByLabelText("5 wins, 2 draws, 1 loss")).toBeInTheDocument();
    expect(screen.getByLabelText("18 goals scored and 9 goals against")).toBeInTheDocument();
    expect(screen.getByText("Goal Balance")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("8 goals")).toBeInTheDocument();
    expect(screen.getByText("Dana")).toBeInTheDocument();
    expect(screen.getByText("7 assists")).toBeInTheDocument();
  });

  it("shows empty messages when the season has no named scorers or assisters", () => {
    render(
      <SeasonStatsCard
        stats={{ ...stats, topScorers: [], topScorerGoals: 0, topAssisters: [], topAssists: 0 }}
      />,
    );

    expect(screen.getByText("No goals yet")).toBeInTheDocument();
    expect(screen.getByText("No assists yet")).toBeInTheDocument();
  });

  it("colors the goal difference badge by its sign", () => {
    const { rerender } = render(<SeasonStatsCard stats={stats} />);
    expect(screen.getByText("+9").parentElement).toHaveClass("text-emerald-700");

    rerender(<SeasonStatsCard stats={{ ...stats, goalsFor: 5, goalsAgainst: 9 }} />);
    expect(screen.getByText("-4").parentElement).toHaveClass("text-rose-700");

    rerender(<SeasonStatsCard stats={{ ...stats, goalsFor: 9, goalsAgainst: 9 }} />);
    expect(screen.getByText("0").parentElement).toHaveClass("text-muted-foreground");
  });

  it("uses singular labels for counts of one", () => {
    render(
      <SeasonStatsCard
        stats={{
          ...stats,
          matches: 1,
          wins: 1,
          draws: 0,
          losses: 1,
          goalsFor: 1,
          goalsAgainst: 0,
          topScorerGoals: 1,
          topAssists: 1,
        }}
      />,
    );

    expect(screen.getByText("· 1 match")).toBeInTheDocument();
    expect(screen.getByLabelText("1 win, 0 draws, 1 loss")).toBeInTheDocument();
    expect(screen.getByLabelText("1 goal scored and 0 goals against")).toBeInTheDocument();
    expect(screen.getByText("1 goal", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("1 assist")).toBeInTheDocument();
    expect(screen.getByText("goal", { selector: "span" })).toBeInTheDocument();
  });

  it("shows all players tied for the lead", () => {
    render(
      <SeasonStatsCard
        stats={{ ...stats, topScorers: ["Alice", "Bob"], topAssisters: ["Dana", "Eli"], topScorerGoals: 3, topAssists: 2 }}
      />,
    );

    expect(screen.getByText("Alice, Bob")).toBeInTheDocument();
    expect(screen.getByText("Dana, Eli")).toBeInTheDocument();
    expect(screen.getByText("3 goals")).toBeInTheDocument();
    expect(screen.getByText("2 assists")).toBeInTheDocument();
  });
});
