import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TasksView } from "../../src/views/TasksView";
import { makeTask, makeTaskList } from "../fixtures/google-tasks";

const {
  getTasksEffectMock,
  completeTaskEffectMock,
  deleteTaskEffectMock,
  runEffectPromiseMock,
  runEffectWithToastMock,
  moveTaskToAnotherListEffectMock,
} = vi.hoisted(() => ({
  getTasksEffectMock: vi.fn(() => "get-tasks-effect"),
  completeTaskEffectMock: vi.fn(() => "complete-task-effect"),
  deleteTaskEffectMock: vi.fn(() => "delete-task-effect"),
  runEffectPromiseMock: vi.fn(),
  runEffectWithToastMock: vi.fn(async () => undefined),
  moveTaskToAnotherListEffectMock: vi.fn(() => "move-task-effect"),
}));

vi.mock("../../src/services/google-tasks/api", () => ({
  completeTaskEffect: completeTaskEffectMock,
  deleteTaskEffect: deleteTaskEffectMock,
  getTasksEffect: getTasksEffectMock,
  patchTaskEffect: vi.fn(() => "patch-task-effect"),
}));

vi.mock("../../src/domain/move", () => ({
  moveTaskToAnotherListEffect: moveTaskToAnotherListEffectMock,
}));

vi.mock("../../src/utils/effect-bridge", () => ({
  runEffectPromise: runEffectPromiseMock,
  runEffectWithToast: runEffectWithToastMock,
}));

vi.mock("../../src/components/CreateTaskForm", () => ({
  CreateTaskForm: () => <div>CreateTaskForm</div>,
}));

vi.mock("../../src/components/EditTaskForm", () => ({
  EditTaskForm: () => <div>EditTaskForm</div>,
}));

describe("TasksView", () => {
  it("filters completed tasks and supports search", async () => {
    const openTask = makeTask({ id: "open-1", title: "Buy milk", position: "a" });
    const completedTask = makeTask({ id: "done-1", title: "Archive receipts", status: "completed", position: "b" });
    runEffectPromiseMock.mockResolvedValue({ items: [openTask, completedTask] });

    render(
      <TasksView
        taskList={makeTaskList({ id: "list-1", title: "Inbox" })}
        allLists={[makeTaskList({ id: "list-1", title: "Inbox" })]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Buy milk")).toBeInTheDocument();
      expect(screen.getByText("Archive receipts")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Filter"), { target: { value: "completed" } });

    await waitFor(() => {
      expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
      expect(screen.getByText("Archive receipts")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Filter"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Search title or notes"), { target: { value: "milk" } });

    await waitFor(() => {
      expect(screen.getByText("Buy milk")).toBeInTheDocument();
      expect(screen.queryByText("Archive receipts")).not.toBeInTheDocument();
    });
  });

  it("completes and deletes tasks through the effect bridge", async () => {
    const task = makeTask({ id: "task-1", title: "Submit report" });
    runEffectPromiseMock.mockResolvedValue({ items: [task] });
    const onListsChanged = vi.fn();

    render(
      <TasksView
        taskList={makeTaskList({ id: "list-1", title: "Inbox" })}
        allLists={[makeTaskList({ id: "list-1", title: "Inbox" })]}
        onListsChanged={onListsChanged}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Submit report")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Complete" }));

    await waitFor(() => {
      expect(completeTaskEffectMock).toHaveBeenCalledWith("list-1", "task-1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteTaskEffectMock).toHaveBeenCalledWith("list-1", "task-1");
    });

    expect(runEffectWithToastMock).toHaveBeenCalled();
    expect(onListsChanged).toHaveBeenCalled();
  });
});
