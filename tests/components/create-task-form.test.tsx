import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateTaskForm } from "../../src/components/CreateTaskForm";
import { makeTask, makeTaskList } from "../fixtures/google-tasks";
import { navigationPopMock, showToastMock } from "../mocks/raycast";

const { createTaskEffectMock, getTasksEffectMock, runEffectPromiseMock, runEffectWithToastMock } = vi.hoisted(() => ({
  createTaskEffectMock: vi.fn(() => "create-task-effect"),
  getTasksEffectMock: vi.fn(() => "get-tasks-effect"),
  runEffectPromiseMock: vi.fn(),
  runEffectWithToastMock: vi.fn(async () => ({ id: "created-task", title: "Created", status: "needsAction" })),
}));

vi.mock("../../src/services/google-tasks/api", () => ({
  createTaskEffect: createTaskEffectMock,
  getTasksEffect: getTasksEffectMock,
}));

vi.mock("../../src/utils/effect-bridge", () => ({
  runEffectPromise: runEffectPromiseMock,
  runEffectWithToast: runEffectWithToastMock,
}));

describe("CreateTaskForm", () => {
  it("validates the title before submitting", async () => {
    render(<CreateTaskForm lists={[makeTaskList({ id: "list-1", title: "Inbox" })]} />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith({
        style: "failure",
        title: "Title is required",
      });
    });
    expect(runEffectWithToastMock).not.toHaveBeenCalled();
  });

  it("rejects invalid natural language due dates", async () => {
    render(<CreateTaskForm lists={[makeTaskList({ id: "list-1", title: "Inbox" })]} />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Buy milk" } });
    fireEvent.change(screen.getByLabelText("Due (natural language)"), { target: { value: "definitely-not-a-date" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith({
        style: "failure",
        title: "Could not parse due date",
        message: "Try a phrase like “tomorrow” or a calendar date like 2026-05-15 (dates only; time is not saved).",
      });
    });
    expect(runEffectWithToastMock).not.toHaveBeenCalled();
  });

  it("creates a locked subtask and calls the save callback", async () => {
    const onSaved = vi.fn();
    const list = makeTaskList({ id: "list-1", title: "Inbox" });

    render(
      <CreateTaskForm
        lists={[list]}
        initialListId={list.id}
        lockedParent={{ id: "parent-1", title: "Parent" }}
        onSaved={onSaved}
      />,
    );

    expect(screen.queryByLabelText("Parent task")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Subtask" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Subtask" }));

    await waitFor(() => {
      expect(createTaskEffectMock).toHaveBeenCalledWith("list-1", {
        title: "Subtask",
        notes: undefined,
        due: undefined,
        parent: "parent-1",
      });
    });
    expect(runEffectWithToastMock).toHaveBeenCalledWith("test-token", "create-task-effect", {
      successTitle: "Subtask created",
      errorTitle: "Could not create task",
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(navigationPopMock).toHaveBeenCalledTimes(1);
  });
});
