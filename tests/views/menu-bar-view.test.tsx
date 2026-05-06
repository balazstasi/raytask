import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MenuBarView } from "../../src/views/MenuBarView";
import { makeTask, makeTaskList, makeTasksResponse } from "../fixtures/google-tasks";
import { seedLocalStorage } from "../mocks/raycast";

const {
  useTaskListsMock,
  runEffectPromiseMock,
  runEffectWithToastMock,
  completeTaskEffectMock,
  patchTaskEffectMock,
} = vi.hoisted(() => ({
  useTaskListsMock: vi.fn(),
  runEffectPromiseMock: vi.fn(),
  runEffectWithToastMock: vi.fn(async () => undefined),
  completeTaskEffectMock: vi.fn(() => "complete-task-effect"),
  patchTaskEffectMock: vi.fn(() => "patch-task-effect"),
}));

vi.mock("../../src/hooks/useTaskLists", () => ({
  useTaskLists: useTaskListsMock,
}));

vi.mock("../../src/utils/effect-bridge", () => ({
  runEffectPromise: runEffectPromiseMock,
  runEffectWithToast: runEffectWithToastMock,
}));

vi.mock("../../src/services/google-tasks/api", () => ({
  completeTaskEffect: completeTaskEffectMock,
  getTasksAllPagesEffect: vi.fn(() => "get-tasks-all-pages-effect"),
  getTasksEffect: vi.fn(() => "get-tasks-effect"),
  patchTaskEffect: patchTaskEffectMock,
}));

describe("MenuBarView", () => {
  it("loads the remembered list and toggles a visible task", async () => {
    const list = makeTaskList({ id: "list-1", title: "Inbox" });
    const dueTask = makeTask({ id: "task-1", title: "Submit report", due: "2026-05-06T00:00:00.000Z" });
    seedLocalStorage("raytask.lastTaskListId", "list-1");

    useTaskListsMock.mockReturnValue({
      lists: [list],
      isLoading: false,
      revalidate: vi.fn(),
    });
    runEffectPromiseMock
      .mockResolvedValueOnce([dueTask])
      .mockResolvedValueOnce(makeTasksResponse([]));

    render(<MenuBarView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Mark complete (due today, overdue, or daily habit match)" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark complete (due today, overdue, or daily habit match)" }));

    expect(completeTaskEffectMock).toHaveBeenCalledWith("list-1", "task-1");
    expect(runEffectWithToastMock).toHaveBeenCalledWith("test-token", "complete-task-effect", {
      errorTitle: "Could not complete task",
    });
  });
});
