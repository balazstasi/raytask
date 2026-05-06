import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeTaskList } from "../fixtures/google-tasks";

const { runEffectPromiseMock, getTaskListsEffectMock } = vi.hoisted(() => ({
  runEffectPromiseMock: vi.fn(),
  getTaskListsEffectMock: vi.fn(() => "get-task-lists-effect"),
}));

vi.mock("../../src/utils/effect-bridge", () => ({
  runEffectPromise: runEffectPromiseMock,
}));

vi.mock("../../src/services/google-tasks/api", () => ({
  getTaskListsEffect: getTaskListsEffectMock,
}));

import { useTaskLists } from "../../src/hooks/useTaskLists";

describe("useTaskLists", () => {
  it("loads task lists via the effect bridge and exposes a derived lists array", async () => {
    const lists = [makeTaskList({ id: "list-1", title: "Inbox" }), makeTaskList({ id: "list-2", title: "Work" })];
    runEffectPromiseMock.mockResolvedValue({ items: lists });

    const { result } = renderHook(() => useTaskLists("Could not load task lists"));

    await waitFor(() => {
      expect(result.current.lists).toEqual(lists);
    });

    expect(getTaskListsEffectMock).toHaveBeenCalledWith({ maxResults: 100 });
    expect(runEffectPromiseMock).toHaveBeenCalledWith("test-token", "get-task-lists-effect");

    const initialCallCount = runEffectPromiseMock.mock.calls.length;
    await result.current.revalidate();

    expect(runEffectPromiseMock.mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});
