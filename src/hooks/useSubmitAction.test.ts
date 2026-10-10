import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSubmitAction } from "./useSubmitAction";

describe("useSubmitAction", () => {
  it("confirms synchronous local actions immediately", () => {
    const onSuccess = vi.fn();
    const action = vi.fn((_player: string) => undefined);
    const { result } = renderHook(() => useSubmitAction(action, onSuccess));
    act(() => {
      void result.current.submit("Alex");
    });
    expect(action).toHaveBeenCalledWith("Alex");
    expect(onSuccess).toHaveBeenCalledWith("Alex");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("blocks duplicate submissions until confirmation, then permits another action", async () => {
    let resolve!: (success: boolean) => void;
    const action = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSubmitAction(action, onSuccess));
    let submitted!: Promise<boolean>;
    act(() => {
      submitted = result.current.submit();
      void result.current.submit();
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(true);
    expect(onSuccess).not.toHaveBeenCalled();
    await act(async () => {
      resolve(true);
      expect(await submitted).toBe(true);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(false);
    act(() => {
      void result.current.submit();
    });
    expect(action).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolve(false);
    });
  });

  it.each(["false", "throw", "reject"])(
    "keeps failure unconfirmed and permits retry (%s)",
    async (mode) => {
      const action = vi.fn(() => {
        if (mode === "throw") throw new Error("failed");
        return mode === "reject" ? Promise.reject(new Error("failed")) : false;
      });
      const onSuccess = vi.fn();
      const { result } = renderHook(() => useSubmitAction(action, onSuccess));
      await act(async () => {
        expect(await result.current.submit()).toBe(false);
      });
      expect(onSuccess).not.toHaveBeenCalled();
      expect(result.current.isSubmitting).toBe(false);
      await act(async () => {
        await result.current.submit();
      });
      expect(action).toHaveBeenCalledTimes(2);
    },
  );
});
