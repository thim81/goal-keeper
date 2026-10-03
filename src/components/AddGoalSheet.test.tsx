import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddGoalSheet } from "./AddGoalSheet";

describe("AddGoalSheet async submission", () => {
  it("stays open while saving, ignores duplicate submits, then closes on success", async () => {
    let resolve: (value: boolean) => void = () => {};
    const onAddGoal = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const onClose = vi.fn();
    const { container } = render(
      <AddGoalSheet isOpen onClose={onClose} onAddGoal={onAddGoal} knownPlayers={[]} />,
    );
    fireEvent.change(screen.getByPlaceholderText("Who scored?"), { target: { value: "Alex" } });

    fireEvent.click(screen.getByRole("button", { name: "Add Goal" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
    fireEvent.click(container.querySelector(".fixed > div")!);

    expect(onAddGoal).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
    resolve(true);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it.each([false, "throw"] as const)("retains values after %s", async (result) => {
    const onAddGoal =
      result === "throw"
        ? vi.fn().mockRejectedValue(new Error("failed"))
        : vi.fn().mockResolvedValue(false);
    render(<AddGoalSheet isOpen onClose={vi.fn()} onAddGoal={onAddGoal} knownPlayers={[]} />);
    fireEvent.change(screen.getByPlaceholderText("Who scored?"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByPlaceholderText("Who assisted?"), { target: { value: "Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Goal" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Add Goal" })).toBeEnabled());
    expect(screen.getByPlaceholderText("Who scored?")).toHaveValue("Alex");
    expect(screen.getByPlaceholderText("Who assisted?")).toHaveValue("Sam");
    expect(screen.getByRole("button", { name: "Add Goal" })).toBeInTheDocument();
  });
});
