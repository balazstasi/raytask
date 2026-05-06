import type React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeTaskList } from "../fixtures/google-tasks";

const {
  useAuthMock,
  getTaskListsEffectMock,
  runEffectPromiseMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn((Component: React.ComponentType) => Component),
  getTaskListsEffectMock: vi.fn(() => "get-task-lists-effect"),
  runEffectPromiseMock: vi.fn(),
}));

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("../../src/services/google-tasks/api", () => ({
  getTaskListsEffect: getTaskListsEffectMock,
}));

vi.mock("../../src/utils/effect-bridge", () => ({
  runEffectPromise: runEffectPromiseMock,
}));

vi.mock("../../src/components/CreateTaskForm", () => ({
  CreateTaskForm: ({ lists }: { lists: { title: string }[] }) => (
    <div>CreateTaskForm: {lists.map((list) => list.title).join(", ")}</div>
  ),
}));

import CreateTaskCommand from "../../src/commands/create-task";

describe("create-task command", () => {
  it("shows a loading form while lists are loading", () => {
    runEffectPromiseMock.mockReturnValue(new Promise(() => undefined));

    render(<CreateTaskCommand />);

    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("shows the empty state when no task lists exist", async () => {
    runEffectPromiseMock.mockResolvedValue({ items: [] });

    render(<CreateTaskCommand />);

    await waitFor(() => {
      expect(
        screen.getByText("No task lists found. Create one in Google Tasks first."),
      ).toBeInTheDocument();
    });
  });

  it("renders the create task form when task lists are available", async () => {
    runEffectPromiseMock.mockResolvedValue({
      items: [makeTaskList({ id: "list-1", title: "Inbox" })],
    });

    render(<CreateTaskCommand />);

    await waitFor(() => {
      expect(screen.getByText("CreateTaskForm: Inbox")).toBeInTheDocument();
    });
    expect(getTaskListsEffectMock).toHaveBeenCalledWith({ maxResults: 100 });
  });
});
