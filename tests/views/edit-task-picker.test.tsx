import type React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeTask, makeTaskList } from "../fixtures/google-tasks";
import { navigationPushMock, seedLocalStorage } from "../mocks/raycast";

const {
  useTaskListsMock,
  getTasksEffectMock,
  runEffectPromiseMock,
} = vi.hoisted(() => ({
  useTaskListsMock: vi.fn(),
  getTasksEffectMock: vi.fn(() => "get-tasks-effect"),
  runEffectPromiseMock: vi.fn(),
}));

vi.mock("../../src/hooks/useTaskLists", () => ({
  useTaskLists: useTaskListsMock,
}));

vi.mock("../../src/services/google-tasks/api", () => ({
  getTasksEffect: getTasksEffectMock,
}));

vi.mock("../../src/utils/effect-bridge", () => ({
  runEffectPromise: runEffectPromiseMock,
}));

vi.mock("../../src/components/EditTaskForm", () => ({
  EditTaskForm: ({ task }: { task: { title: string } }) => <div>EditTaskForm: {task.title}</div>,
}));

vi.mock("../../src/components/CreateTaskForm", () => ({
  CreateTaskForm: ({ lockedParent }: { lockedParent: { title: string } }) => <div>CreateTaskForm: {lockedParent.title}</div>,
}));

import { EditTaskPicker } from "../../src/views/EditTaskPicker";

describe("EditTaskPicker", () => {
  it("restores the remembered list and pushes edit/add-subtask flows", async () => {
    const listA = makeTaskList({ id: "list-1", title: "Inbox" });
    const listB = makeTaskList({ id: "list-2", title: "Work" });
    const rootTask = makeTask({ id: "task-1", title: "Quarterly review", position: "a" });
    const childTask = makeTask({ id: "task-2", title: "Prepare slides", parent: "task-1", position: "a" });
    seedLocalStorage("raytask.lastTaskListId", "list-2");

    useTaskListsMock.mockReturnValue({
      lists: [listA, listB],
      isLoading: false,
      revalidate: vi.fn(),
    });
    runEffectPromiseMock.mockResolvedValue({ items: [rootTask, childTask] });

    render(<EditTaskPicker />);

    await waitFor(() => {
      expect(getTasksEffectMock).toHaveBeenCalledWith("list-2", {
        maxResults: 100,
        showCompleted: true,
      });
    });

    fireEvent.change(screen.getByLabelText("Search tasks"), { target: { value: "Quarterly" } });

    await waitFor(() => {
      expect(screen.getByText("Quarterly review")).toBeInTheDocument();
      expect(screen.queryByText("Prepare slides")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect((navigationPushMock.mock.calls[0]?.[0] as React.ReactElement).props.task.title).toBe("Quarterly review");

    fireEvent.click(screen.getByRole("button", { name: "Add Subtask" }));
    expect((navigationPushMock.mock.calls[1]?.[0] as React.ReactElement).props.lockedParent.title).toBe("Quarterly review");
  });
});
