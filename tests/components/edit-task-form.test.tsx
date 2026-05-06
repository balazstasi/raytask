import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditTaskForm } from "../../src/components/EditTaskForm";
import { makeTask, makeTaskList } from "../fixtures/google-tasks";
import { showToastMock } from "../mocks/raycast";

const { patchTaskEffectMock, moveTaskToAnotherListEffectMock, runEffectWithToastMock } = vi.hoisted(() => ({
  patchTaskEffectMock: vi.fn(() => "patch-task-effect"),
  moveTaskToAnotherListEffectMock: vi.fn(() => "move-task-effect"),
  runEffectWithToastMock: vi.fn(async () => undefined),
}));

vi.mock("../../src/services/google-tasks/api", () => ({
  patchTaskEffect: patchTaskEffectMock,
}));

vi.mock("../../src/domain/move", () => ({
  moveTaskToAnotherListEffect: moveTaskToAnotherListEffectMock,
}));

vi.mock("../../src/utils/effect-bridge", () => ({
  runEffectWithToast: runEffectWithToastMock,
}));

describe("EditTaskForm", () => {
  it("patches a task when staying in the same list", async () => {
    const task = makeTask({
      id: "task-1",
      title: "Original title",
      notes: "Original notes",
      status: "needsAction",
    });
    const list = makeTaskList({ id: "list-1", title: "Inbox" });

    render(<EditTaskForm taskListId="list-1" task={task} lists={[list]} />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(patchTaskEffectMock).toHaveBeenCalledWith("list-1", "task-1", {
        title: "Updated title",
        notes: "Original notes",
        status: "needsAction",
      });
    });
    expect(runEffectWithToastMock).toHaveBeenCalledWith("test-token", "patch-task-effect", {
      successTitle: "Task updated",
      errorTitle: "Could not save task",
    });
  });

  it("blocks cross-list moves when relationship context is missing", async () => {
    const task = makeTask({ id: "task-1", title: "Task" });
    const lists = [
      makeTaskList({ id: "list-1", title: "Inbox" }),
      makeTaskList({ id: "list-2", title: "Work" }),
    ];

    render(<EditTaskForm taskListId="list-1" task={task} lists={lists} />);

    fireEvent.change(screen.getByLabelText("List"), { target: { value: "list-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith({
        style: "failure",
        title: "Could not move task",
        message: "Reload the source list first so RayTask can preserve subtasks and avoid data loss.",
      });
    });
    expect(moveTaskToAnotherListEffectMock).not.toHaveBeenCalled();
  });

  it("uses the move effect for cross-list saves when relationship context is available", async () => {
    const task = makeTask({ id: "task-1", title: "Task", status: "completed" });
    const lists = [
      makeTaskList({ id: "list-1", title: "Inbox" }),
      makeTaskList({ id: "list-2", title: "Work" }),
    ];

    render(<EditTaskForm taskListId="list-1" task={task} lists={lists} relationshipContext={[task]} />);

    fireEvent.change(screen.getByLabelText("List"), { target: { value: "list-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(moveTaskToAnotherListEffectMock).toHaveBeenCalledWith("list-1", "list-2", expect.objectContaining({
        id: "task-1",
        title: "Task",
        status: "completed",
      }), [task]);
    });
    expect(runEffectWithToastMock).toHaveBeenCalledWith("test-token", "move-task-effect", {
      successTitle: "Task updated",
      errorTitle: "Could not save task",
    });
  });
});
