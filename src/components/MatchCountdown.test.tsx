// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MatchCountdown } from "./MatchCountdown";

it("hides the countdown at kickoff", () => {
  const props = {
    match: {
      id: "fixture",
      start: "2026-09-27T12:00:00Z",
      homeTeam: "Our team",
      awayTeam: "Opponent",
      opponentName: "Opponent",
      isHome: true,
    },
    teamName: "Our team",
  };
  const { rerender } = render(<MatchCountdown {...props} secondsRemaining={1200} />);
  expect(screen.getByText("Start in:")).toBeInTheDocument();
  expect(screen.getByText("20 min")).toBeInTheDocument();

  rerender(<MatchCountdown {...props} secondsRemaining={0} />);
  expect(screen.queryByText("Start in:")).not.toBeInTheDocument();
  expect(screen.queryByText("00:00")).not.toBeInTheDocument();
  expect(screen.queryByText(/\d+ min/)).not.toBeInTheDocument();
});
