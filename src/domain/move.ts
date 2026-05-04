import { Effect } from "effect";
import * as api from "../services/google-tasks/api";
import { GoogleTasksHttpError, type GoogleTasksError } from "../services/google-tasks/errors";
import type { GoogleTasksClient } from "../services/google-tasks/client";
import type { Task } from "../services/google-tasks/schema";

function sortTasksByPosition(a: Task, b: Task): number {
  return (a.position ?? "").localeCompare(b.position ?? "");
}

function hasNonPortableMetadata(task: Task): boolean {
  return Boolean(task.assignmentInfo) || (task.links?.length ?? 0) > 0;
}

function listChildrenByParent(tasks: Task[]): Map<string, Task[]> {
  const childrenByParent = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.parent) continue;
    const children = childrenByParent.get(task.parent);
    if (children) {
      children.push(task);
    } else {
      childrenByParent.set(task.parent, [task]);
    }
  }
  for (const children of childrenByParent.values()) {
    children.sort(sortTasksByPosition);
  }
  return childrenByParent;
}

function collectDescendants(rootTaskId: string, tasks: Task[]): Task[] {
  const childrenByParent = listChildrenByParent(tasks);
  const descendants: Task[] = [];

  const visit = (parentId: string) => {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      descendants.push(child);
      visit(child.id);
    }
  };

  visit(rootTaskId);
  return descendants;
}

function portableTaskPayload(task: Task, parent?: string): {
  title: string;
  notes?: string;
  due?: string;
  status: "needsAction" | "completed";
  parent?: string;
} {
  return {
    title: task.title,
    notes: task.notes,
    due: task.due,
    status: task.status ?? "needsAction",
    parent,
  };
}

function cleanupCreatedTasksEffect(taskListId: string, createdTaskIds: string[]): Effect.Effect<void, never, GoogleTasksClient> {
  return Effect.forEach(
    [...createdTaskIds].reverse(),
    (taskId) =>
      api.deleteTaskEffect(taskListId, taskId).pipe(
        Effect.catchAll(() => Effect.void),
      ),
    { discard: true },
  );
}

/**
 * Google Tasks `tasks.move` only reorders within one list. Cross-list "move" is implemented as
 * copy + delete. Read-only Google metadata such as assignment context and non-empty links cannot
 * be recreated on another list, so those moves are blocked up-front instead of silently losing data.
 */
export function moveTaskToAnotherListEffect(
  sourceListId: string,
  targetListId: string,
  task: Task,
  relatedTasks?: Task[],
): Effect.Effect<void, GoogleTasksError, GoogleTasksClient> {
  return Effect.gen(function* () {
    const taskId = task.id;
    const sourceTasks =
      relatedTasks ??
      (yield* api.getTasksAllPagesEffect(sourceListId, {
        maxResults: 100,
        showCompleted: true,
        showHidden: true,
      }));

    const descendants = collectDescendants(taskId, sourceTasks);
    const subtree = [task, ...descendants];
    const blockedTask = subtree.find(hasNonPortableMetadata);

    if (blockedTask) {
      yield* Effect.fail(
        new GoogleTasksHttpError({
          status: 400,
          message: "This task includes Google-managed metadata that cannot be preserved across lists. Open it in Google Tasks instead.",
        }),
      );
    }

    const createdTaskIds: string[] = [];
    const targetTaskIdsBySourceId = new Map<string, string>();

    yield* Effect.gen(function* () {
      const createdRoot = yield* api.createTaskEffect(targetListId, portableTaskPayload(task));
      createdTaskIds.push(createdRoot.id);
      targetTaskIdsBySourceId.set(taskId, createdRoot.id);

      for (const descendant of descendants) {
        const targetParentId = descendant.parent ? targetTaskIdsBySourceId.get(descendant.parent) : undefined;
        const createdTask = yield* api.createTaskEffect(
          targetListId,
          portableTaskPayload(descendant, targetParentId),
        );
        createdTaskIds.push(createdTask.id);
        targetTaskIdsBySourceId.set(descendant.id, createdTask.id);
      }
    }).pipe(
      Effect.catchAll((error) =>
        cleanupCreatedTasksEffect(targetListId, createdTaskIds).pipe(
          Effect.andThen(() => Effect.fail(error)),
        ),
      ),
    );

    const sourceTaskIdsToDelete = [...descendants.map((descendant) => descendant.id).reverse(), taskId];

    yield* Effect.forEach(sourceTaskIdsToDelete, (sourceTaskId) => api.deleteTaskEffect(sourceListId, sourceTaskId), {
      discard: true,
    }).pipe(
      Effect.catchAll(() =>
        Effect.fail(
          new GoogleTasksHttpError({
            status: 409,
            message: "Task copied to the target list, but cleanup of the source list failed. Review both lists before retrying.",
          }),
        ),
      ),
    );
  });
}
