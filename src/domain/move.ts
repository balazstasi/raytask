import { Effect } from "effect";
import * as api from "../services/google-tasks/api";
import { GoogleTasksHttpError, type GoogleTasksError } from "../services/google-tasks/errors";
import type { Task } from "../types";

/**
 * Google Tasks `tasks.move` only reorders within one list. Cross-list "move" is implemented as
 * copy + delete with rollback: if the copy fails, the original task is restored.
 */
export function moveTaskToAnotherListEffect(
  accessToken: string,
  sourceListId: string,
  targetListId: string,
  task: Task,
): Effect.Effect<void, GoogleTasksError> {
  return Effect.gen(function* () {
    const title = task.title ?? "";
    if (!task.id) {
      yield* Effect.fail(new GoogleTasksHttpError({ status: 0, message: "Task has no id" }));
      return;
    }

    // Soft-delete (hide) from source first so the user doesn't see a duplicate
    yield* api.patchTaskEffect(accessToken, sourceListId, task.id, { hidden: true });

    yield* api.createTaskEffect(accessToken, targetListId, {
      title,
      notes: task.notes,
      due: task.due,
      status: task.status ?? "needsAction",
    }).pipe(
      Effect.andThen(() => api.deleteTaskEffect(accessToken, sourceListId, task.id!)),
      Effect.catchAll((e) =>
        api.patchTaskEffect(accessToken, sourceListId, task.id!, { hidden: false }).pipe(
          Effect.andThen(() => Effect.fail(e)),
        ),
      ),
    );
  });
}

