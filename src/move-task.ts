import * as api from "./api";
import type { Task } from "./types";

/**
 * Google Tasks `tasks.move` only reorders within one list. Cross-list “move” is implemented as copy + delete.
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

  await api.createTask(accessToken, targetListId, {
    title,
    notes: task.notes,
    due: task.due,
    status: task.status ?? "needsAction",
  });
  await api.deleteTask(accessToken, sourceListId, task.id);
}
