import type React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeTaskList } from "../fixtures/google-tasks";
import { navigationPushMock } from "../mocks/raycast";

const { useTaskListsMock } = vi.hoisted(() => ({
  useTaskListsMock: vi.fn(),
}));

vi.mock("../../src/hooks/useTaskLists", () => ({
  useTaskLists: useTaskListsMock,
}));

vi.mock("../../src/views/TasksView", () => ({
  TasksView: ({ taskList }: { taskList: { title: string } }) => <div>TasksView: {taskList.title}</div>,
}));

import { TaskListsView } from "../../src/views/TaskListsView";

describe("TaskListsView", () => {
  it("shows the empty state when no task lists are available", () => {
    useTaskListsMock.mockReturnValue({
      lists: [],
      isLoading: false,
      revalidate: vi.fn(),
    });

    render(<TaskListsView />);

    expect(screen.getByText("No task lists")).toBeInTheDocument();
  });

  it("pushes the tasks view when a list is opened", () => {
    const list = makeTaskList({ id: "list-1", title: "Inbox" });
    useTaskListsMock.mockReturnValue({
      lists: [list],
      isLoading: false,
      revalidate: vi.fn(),
    });

    render(<TaskListsView />);

    fireEvent.click(screen.getByRole("button", { name: "Open List" }));

    expect(navigationPushMock).toHaveBeenCalledTimes(1);
    expect((navigationPushMock.mock.calls[0]?.[0] as React.ReactElement).props.taskList.title).toBe("Inbox");
  });
});
