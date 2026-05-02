import * as api from "./api";
import type { Task } from "./types";

/**
 * Google Tasks `tasks.move` only reorders within one list. Cross-list "move" is implemented as
 * copy + delete with rollback: if the copy fails, the original task is restored.
 */
export async function moveTaskToAnotherList(
  accessToken: string,
  sourceListId: string,
  targetListId: string,
  task: Task,
): Promise<void> {
  const title = task.title ?? "";
  if (!task.id) {
    throw new Error("Task has no id");
  }

  // Soft-delete (hide) from source first so the user doesn't see a duplicate
  await api.patchTask(accessToken, sourceListId, task.id, { hidden: true });

  try {
    await api.createTask(accessToken, targetListId, {
      title,
      notes: task.notes,
      due: task.due,
      status: task.status ?? "needsAction",
    });
    // Permanently delete from source
    await api.deleteTask(accessToken, sourceListId, task.id);
  } catch (e) {
    // Rollback: restore the task in the source list
    await api.patchTask(accessToken, sourceListId, task.id, { hidden: false });
    throw e;
  }
}
