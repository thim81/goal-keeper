import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { GoalTimeline } from "./GoalTimeline";
import type { Goal, GameEvent } from "@/types/match";

const goal: Goal = {
  id: "g1",
  team: "my-team",
  scorer: "Alice",
  type: "normal",
  time: "10:00",
  timestamp: 1000,
};

const event: GameEvent = {
  id: "e1",
  type: "yellow-card",
  team: "opponent",
  player: "Bob",
  time: "20:00",
  timestamp: 2000,
};

function swipe(element: Element, distance: number) {
  fireEvent.pointerDown(element, { clientX: 0 });
  fireEvent.pointerMove(element, { clientX: distance });
  fireEvent.pointerUp(element);
}

describe("GoalTimeline", () => {
  it("does not open the goal editor on a quick tap, scroll, swipe, or read-only row", () => {
    vi.useFakeTimers();
    const props = {
      goals: [goal],
      events: [],
      myTeamName: "My Team",
      opponentName: "Rivals",
      onUpdateGoal: vi.fn(),
      onDeleteGoal: vi.fn(),
    };
    const { rerender } = render(<GoalTimeline {...props} editable />);
    const row = screen.getByText("Alice");
    fireEvent.pointerDown(row, { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(row);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.pointerDown(row, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(row, { clientX: 0, clientY: 20 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerCancel(row);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    swipe(row, -60);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete goal" })).toBeInTheDocument();
    rerender(<GoalTimeline {...props} editable={false} />);
    fireEvent.pointerDown(row);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("opens a prefilled goal editor on long press and saves changes", () => {
    vi.useFakeTimers();
    const onUpdateGoal = vi.fn();
    render(
      <GoalTimeline
        goals={[goal]}
        events={[]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
        onUpdateGoal={onUpdateGoal}
      />,
    );
    fireEvent.pointerDown(screen.getByText("Alice"), { clientX: 0, clientY: 0 });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("dialog")).toHaveTextContent("Edit goal");
    expect(screen.queryByRole("group", { name: "Team" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("Alice"), { target: { value: "Bob" } });
    fireEvent.change(screen.getByPlaceholderText("Who assisted?"), { target: { value: "Carl" } });
    fireEvent.click(screen.getByRole("button", { name: "Header" }));
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "10:15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onUpdateGoal).toHaveBeenCalledWith("g1", {
      scorer: "Bob",
      assist: "Carl",
      type: "head",
      time: "10:15",
    });
  });

  it("discards goal edits on close and hides player fields for opponents", () => {
    vi.useFakeTimers();
    const onUpdateGoal = vi.fn();
    render(
      <GoalTimeline
        goals={[{ ...goal, team: "opponent", scorer: undefined }]}
        events={[]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
        onUpdateGoal={onUpdateGoal}
      />,
    );
    fireEvent.pointerDown(screen.getByText("Rivals"));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("group", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Who scored?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Penalty" }));
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onUpdateGoal).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an empty state when there are no goals or events", () => {
    render(
      <GoalTimeline goals={[]} events={[]} myTeamName="My Team" opponentName="Rivals" editable />,
    );

    expect(screen.getByText("No goals yet")).toBeInTheDocument();
  });

  it("renders goals and events ordered by timestamp", () => {
    const earlierEvent: GameEvent = { ...event, id: "e0", timestamp: 500, type: "start" };
    render(
      <GoalTimeline
        goals={[goal]}
        events={[event, earlierEvent]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
      />,
    );

    const rows = screen.getAllByText(/Match Started|Alice|Bob/);
    const order = rows.map((el) => el.textContent);
    expect(order.indexOf("Match Started")).toBeLessThan(
      order.findIndex((t) => t?.includes("Alice")),
    );
    expect(order.findIndex((t) => t?.includes("Alice"))).toBeLessThan(
      order.findIndex((t) => t?.includes("Bob")),
    );
  });

  it("deletes a goal after swiping its row past the reveal threshold", () => {
    const onDeleteGoal = vi.fn();
    render(
      <GoalTimeline
        goals={[goal]}
        events={[]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
        onDeleteGoal={onDeleteGoal}
      />,
    );

    swipe(screen.getByText("Alice"), -60);
    fireEvent.click(screen.getByRole("button", { name: /delete goal/i }));

    expect(onDeleteGoal).toHaveBeenCalledWith("g1");
  });

  it("deletes an event after swiping its row past the reveal threshold", () => {
    const onDeleteEvent = vi.fn();
    render(
      <GoalTimeline
        goals={[]}
        events={[event]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
        onDeleteEvent={onDeleteEvent}
      />,
    );

    swipe(screen.getByText(/Bob/), -60);
    fireEvent.click(screen.getByRole("button", { name: /delete event/i }));

    expect(onDeleteEvent).toHaveBeenCalledWith("e1");
  });

  it("does not reveal a delete action when a swipe does not clear the threshold", () => {
    const onDeleteGoal = vi.fn();
    render(
      <GoalTimeline
        goals={[goal]}
        events={[]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
        onDeleteGoal={onDeleteGoal}
      />,
    );

    swipe(screen.getByText("Alice"), -10);

    expect(screen.queryByRole("button", { name: /delete goal/i })).not.toBeInTheDocument();
  });

  it("does not allow swipe-to-delete when not editable", () => {
    render(
      <GoalTimeline
        goals={[goal]}
        events={[]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable={false}
        onDeleteGoal={vi.fn()}
      />,
    );

    swipe(screen.getByText("Alice"), -60);

    expect(screen.queryByRole("button", { name: /delete goal/i })).not.toBeInTheDocument();
  });

  it("opens the period time editor on long press and saves the selected time", () => {
    vi.useFakeTimers();
    const onUpdateEventTime = vi.fn();
    const periodStart: GameEvent = {
      ...event,
      id: "start-1",
      type: "start",
      label: "Start Period 1",
    };
    render(
      <GoalTimeline
        goals={[]}
        events={[periodStart]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
        onDeleteEvent={vi.fn()}
        onUpdateEventTime={onUpdateEventTime}
      />,
    );

    const row = screen.getByText("Start Period 1");
    fireEvent.pointerDown(row, { clientX: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const input = screen.getByDisplayValue("20:00");
    fireEvent.change(input, { target: { value: "20:30" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onUpdateEventTime).toHaveBeenCalledWith("start-1", "20:30");
  });

  it("keeps swipe-to-delete behavior when the row moves horizontally", () => {
    vi.useFakeTimers();
    const onUpdateEventTime = vi.fn();
    const onDeleteEvent = vi.fn();
    const periodStart: GameEvent = {
      ...event,
      id: "start-2",
      type: "start",
      label: "Start Period 1",
    };
    render(
      <GoalTimeline
        goals={[]}
        events={[periodStart]}
        myTeamName="My Team"
        opponentName="Rivals"
        editable
        onDeleteEvent={onDeleteEvent}
        onUpdateEventTime={onUpdateEventTime}
      />,
    );

    const row = screen.getByText("Start Period 1");
    fireEvent.pointerDown(row, { clientX: 0 });
    fireEvent.pointerMove(row, { clientX: -60 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.pointerUp(row);

    expect(screen.getByRole("button", { name: /delete event/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
