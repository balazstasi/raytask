import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleTasksHttpError } from "../../src/services/google-tasks/errors";
import { makeTask } from "../fixtures/google-tasks";
import { runGoogleEffect } from "../helpers/run-google-effect";

const { createTaskEffectMock, deleteTaskEffectMock, getTasksAllPagesEffectMock } = vi.hoisted(() => ({
  createTaskEffectMock: vi.fn(),
  deleteTaskEffectMock: vi.fn(),
  getTasksAllPagesEffectMock: vi.fn(),
}));

vi.mock("../../src/services/google-tasks/api", () => ({
  createTaskEffect: createTaskEffectMock,
  deleteTaskEffect: deleteTaskEffectMock,
  getTasksAllPagesEffect: getTasksAllPagesEffectMock,
}));

import { moveTaskToAnotherListEffect } from "../../src/domain/move";

describe("cross-list move", () => {
  beforeEach(() => {
    createTaskEffectMock.mockReset();
    deleteTaskEffectMock.mockReset();
    getTasksAllPagesEffectMock.mockReset();
  });

  it("rejects tasks with non-portable Google metadata", async () => {
    const task = makeTask({
      id: "task-1",
      assignmentInfo: { source: "google-managed" },
    });

    await expect(runGoogleEffect(moveTaskToAnotherListEffect("source", "target", task, [task]))).rejects.toThrow(
      "This task includes Google-managed metadata that cannot be preserved across lists. Open it in Google Tasks instead.",
    );
    expect(createTaskEffectMock).not.toHaveBeenCalled();
  });

  it("copies a subtree and deletes the source tasks in reverse order", async () => {
    const root = makeTask({ id: "root", title: "Root" });
    const child = makeTask({ id: "child", title: "Child", parent: "root", position: "a" });
    const grandchild = makeTask({ id: "grandchild", title: "Grandchild", parent: "child", position: "a" });

    createTaskEffectMock
      .mockReturnValueOnce(Effect.succeed(makeTask({ id: "new-root", title: "Root" })))
      .mockReturnValueOnce(Effect.succeed(makeTask({ id: "new-child", title: "Child" })))
      .mockReturnValueOnce(Effect.succeed(makeTask({ id: "new-grandchild", title: "Grandchild" })));
    deleteTaskEffectMock.mockReturnValue(Effect.succeed(undefined));

    await expect(runGoogleEffect(moveTaskToAnotherListEffect("source", "target", root, [root, child, grandchild]))).resolves.toBeUndefined();

    expect(createTaskEffectMock).toHaveBeenNthCalledWith(1, "target", {
      title: "Root",
      notes: undefined,
      due: undefined,
      status: "needsAction",
      parent: undefined,
    });
    expect(createTaskEffectMock).toHaveBeenNthCalledWith(2, "target", {
      title: "Child",
      notes: undefined,
      due: undefined,
      status: "needsAction",
      parent: "new-root",
    });
    expect(createTaskEffectMock).toHaveBeenNthCalledWith(3, "target", {
      title: "Grandchild",
      notes: undefined,
      due: undefined,
      status: "needsAction",
      parent: "new-child",
    });
    expect(deleteTaskEffectMock.mock.calls).toEqual([
      ["source", "grandchild"],
      ["source", "child"],
      ["source", "root"],
    ]);
  });

  it("rolls back created tasks when copy fails partway through", async () => {
    const root = makeTask({ id: "root", title: "Root" });
    const child = makeTask({ id: "child", title: "Child", parent: "root" });

    createTaskEffectMock
      .mockReturnValueOnce(Effect.succeed(makeTask({ id: "new-root", title: "Root" })))
      .mockReturnValueOnce(
        Effect.fail(
          new GoogleTasksHttpError({
            status: 500,
            message: "copy failed",
          }),
        ),
      );
    deleteTaskEffectMock.mockReturnValue(Effect.succeed(undefined));

    await expect(runGoogleEffect(moveTaskToAnotherListEffect("source", "target", root, [root, child]))).rejects.toThrow(
      "copy failed",
    );

    expect(deleteTaskEffectMock).toHaveBeenCalledWith("target", "new-root");
  });

  it("raises a conflict error when source cleanup fails", async () => {
    const root = makeTask({ id: "root", title: "Root" });

    createTaskEffectMock.mockReturnValue(Effect.succeed(makeTask({ id: "new-root", title: "Root" })));
    deleteTaskEffectMock.mockReturnValueOnce(
      Effect.fail(
        new GoogleTasksHttpError({
          status: 500,
          message: "delete failed",
        }),
      ),
    );

    await expect(runGoogleEffect(moveTaskToAnotherListEffect("source", "target", root, [root]))).rejects.toThrow(
      "Task copied to the target list, but cleanup of the source list failed. Review both lists before retrying.",
    );
  });
});
