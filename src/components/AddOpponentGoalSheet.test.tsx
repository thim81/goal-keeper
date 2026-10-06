import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddOpponentGoalSheet } from "./AddOpponentGoalSheet";

describe("AddOpponentGoalSheet", () => {
  it("keeps controls available while guarding duplicate submissions", async () => {
    let resolve!: (value: boolean) => void;
    const onAddGoal = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const onClose = vi.fn();
    const { container } = render(
      <AddOpponentGoalSheet isOpen onClose={onClose} onAddGoal={onAddGoal} opponentName="Rivals" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Goal" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Goal" }));
    expect(onAddGoal).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
    container.querySelectorAll("button").forEach((control) => expect(control).toBeEnabled());
    resolve(true);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
  it("renders nothing when closed", () => {
    const { container } = render(
      <AddOpponentGoalSheet
        isOpen={false}
        onClose={vi.fn()}
        onAddGoal={vi.fn()}
        opponentName="Rivals"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to a normal goal and closes on submit", () => {
    const onAddGoal = vi.fn();
    const onClose = vi.fn();
    render(
      <AddOpponentGoalSheet isOpen onClose={onClose} onAddGoal={onAddGoal} opponentName="Rivals" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add goal/i }));

    expect(onAddGoal).toHaveBeenCalledWith("normal");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits the selected goal type", () => {
    const onAddGoal = vi.fn();
    render(
      <AddOpponentGoalSheet isOpen onClose={vi.fn()} onAddGoal={onAddGoal} opponentName="Rivals" />,
    );

    fireEvent.click(screen.getByText("Own Goal"));
    fireEvent.click(screen.getByRole("button", { name: /add goal/i }));

    expect(onAddGoal).toHaveBeenCalledWith("own-goal");
  });

  it("shows the opponent name in the header", () => {
    render(
      <AddOpponentGoalSheet isOpen onClose={vi.fn()} onAddGoal={vi.fn()} opponentName="Rivals" />,
    );

    expect(screen.getByText("Rivals Goal")).toBeInTheDocument();
  });

  it.each([false, "throw"] as const)("keeps selected goal type after %s", async (result) => {
    const onAddGoal =
      result === "throw"
        ? vi.fn().mockRejectedValue(new Error("failed"))
        : vi.fn().mockResolvedValue(false);
    render(
      <AddOpponentGoalSheet isOpen onClose={vi.fn()} onAddGoal={onAddGoal} opponentName="Rivals" />,
    );
    fireEvent.click(screen.getByText("Own Goal"));
    fireEvent.click(screen.getByRole("button", { name: "Add Goal" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Add Goal" })).toBeEnabled());
    expect(screen.getByText("Own Goal").closest("button")).toHaveClass("border-accent");
  });
});
