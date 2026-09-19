import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MatchActions } from "./MatchActions";

function renderActions(overrides: Partial<Parameters<typeof MatchActions>[0]> = {}) {
  const handlers = {
    onAddMyGoal: vi.fn(),
    onAddOpponentGoal: vi.fn(),
    onAddEvent: vi.fn(),
    onUndo: vi.fn(),
    onEndMatch: vi.fn(),
    onStartPeriod: vi.fn(),
    onEndPeriod: vi.fn(),
    onToggleTimer: vi.fn(),
  };
  render(
    <MatchActions
      {...handlers}
      isRunning
      canUndo
      currentPeriod={1}
      isPeriodEnded={false}
      isHome
      showSecondaryActions
      {...overrides}
    />,
  );
  return handlers;
}

describe("MatchActions", () => {
  it("wires the goal buttons to their handlers", () => {
    const handlers = renderActions();

    fireEvent.click(screen.getByRole("button", { name: /we scored!/i }));
    fireEvent.click(screen.getByRole("button", { name: /they scored/i }));

    expect(handlers.onAddMyGoal).toHaveBeenCalledTimes(1);
    expect(handlers.onAddOpponentGoal).toHaveBeenCalledTimes(1);
  });

  it("shows End Period and calls onEndPeriod when the period is still running", () => {
    const handlers = renderActions({ isPeriodEnded: false, currentPeriod: 2 });

    fireEvent.click(screen.getByRole("button", { name: /end period 2/i }));

    expect(handlers.onEndPeriod).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/start period/i)).not.toBeInTheDocument();
  });

  it("shows Start Period (next) and calls onStartPeriod once the period has ended", () => {
    const handlers = renderActions({ isPeriodEnded: true, currentPeriod: 2 });

    fireEvent.click(screen.getByRole("button", { name: /start period 3/i }));

    expect(handlers.onStartPeriod).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/end period/i)).not.toBeInTheDocument();
  });

  it("disables the timer toggle only when paused and the period has ended", () => {
    const { rerender } = render(
      <MatchActions
        onAddMyGoal={vi.fn()}
        onAddOpponentGoal={vi.fn()}
        onAddEvent={vi.fn()}
        onUndo={vi.fn()}
        onEndMatch={vi.fn()}
        onStartPeriod={vi.fn()}
        onEndPeriod={vi.fn()}
        onToggleTimer={vi.fn()}
        isRunning={false}
        canUndo
        currentPeriod={1}
        isPeriodEnded
        isHome
      />,
    );
    expect(screen.getByRole("button", { name: /resume time/i })).toBeDisabled();

    rerender(
      <MatchActions
        onAddMyGoal={vi.fn()}
        onAddOpponentGoal={vi.fn()}
        onAddEvent={vi.fn()}
        onUndo={vi.fn()}
        onEndMatch={vi.fn()}
        onStartPeriod={vi.fn()}
        onEndPeriod={vi.fn()}
        onToggleTimer={vi.fn()}
        isRunning
        canUndo
        currentPeriod={1}
        isPeriodEnded
        isHome
      />,
    );
    expect(screen.getByRole("button", { name: /pause time/i })).not.toBeDisabled();
  });

  it("disables Undo when canUndo is false and calls onUndo/onEndMatch when clicked", () => {
    const handlers = renderActions({ canUndo: false });
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^end$/i }));
    expect(handlers.onEndMatch).toHaveBeenCalledTimes(1);
  });

  it("calls onUndo when Undo is enabled and clicked", () => {
    const handlers = renderActions({ canUndo: true });

    fireEvent.click(screen.getByRole("button", { name: /undo/i }));

    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
  });

  it("calls onAddEvent when the Event button is clicked", () => {
    const handlers = renderActions();

    fireEvent.click(screen.getByRole("button", { name: /^event$/i }));

    expect(handlers.onAddEvent).toHaveBeenCalledTimes(1);
  });

  it("hides the secondary actions (event/undo/end) when showSecondaryActions is false", () => {
    renderActions({ showSecondaryActions: false });

    expect(screen.queryByRole("button", { name: /^end$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^event$/i })).not.toBeInTheDocument();
  });
});
