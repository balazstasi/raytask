import type React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LaunchProps } from "@raycast/api";
import QuickAddCommand from "../../src/commands/quick-add";
import { makeTaskList } from "../fixtures/google-tasks";
import { popToRootMock, showToastMock } from "../mocks/raycast";

const {
  useAuthMock,
  useTaskListsMock,
  createTaskEffectMock,
  runEffectWithToastMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn((Component: React.ComponentType<any>) => Component),
  useTaskListsMock: vi.fn(),
  createTaskEffectMock: vi.fn(() => "create-task-effect"),
  runEffectWithToastMock: vi.fn(async () => undefined),
}));

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("../../src/hooks/useTaskLists", () => ({
  useTaskLists: useTaskListsMock,
}));

vi.mock("../../src/services/google-tasks/api", () => ({
  createTaskEffect: createTaskEffectMock,
}));

vi.mock("../../src/utils/effect-bridge", () => ({
  runEffectWithToast: runEffectWithToastMock,
}));

describe("QuickAddCommand", () => {
  it("rejects invalid due input instead of creating the task", async () => {
    useTaskListsMock.mockReturnValue({
      lists: [makeTaskList({ id: "list-1", title: "Inbox" })],
      isLoading: false,
    });

    render(
      <QuickAddCommand
        {...({
          arguments: {
            title: "Pay rent",
            due: "not-a-date",
          },
        } satisfies LaunchProps<{ arguments: Arguments.QuickAdd }>)}
      />,
    );

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith({
        style: "failure",
        title: "Could not parse due date",
        message: "Try a phrase like “tomorrow” or a calendar date like 2026-05-15 (dates only; time is not saved).",
      });
    });

    expect(createTaskEffectMock).not.toHaveBeenCalled();
  });

  it("creates the task and returns to the root command on success", async () => {
    useTaskListsMock.mockReturnValue({
      lists: [makeTaskList({ id: "list-1", title: "Inbox" })],
      isLoading: false,
    });

    render(
      <QuickAddCommand
        {...({
          arguments: {
            title: "Pay rent",
            due: "2026-05-07",
          },
        } satisfies LaunchProps<{ arguments: Arguments.QuickAdd }>)}
      />,
    );

    await waitFor(() => {
      expect(createTaskEffectMock).toHaveBeenCalledWith("list-1", {
        title: "Pay rent",
        due: "2026-05-07T00:00:00.000Z",
      });
    });
    expect(runEffectWithToastMock).toHaveBeenCalledWith("test-token", "create-task-effect", {
      successTitle: "Task added",
      errorTitle: "Could not create task",
    });
    expect(popToRootMock).toHaveBeenCalled();
  });
});
