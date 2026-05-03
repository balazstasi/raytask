import { Effect } from "effect";
import { LocalStorage } from "@raycast/api";

export const LAST_TASK_LIST_ID_KEY = "raytask.lastTaskListId";

export function rememberTaskListIdEffect(listId: string): Effect.Effect<void> {
  return Effect.tryPromise({
    try: () => LocalStorage.setItem(LAST_TASK_LIST_ID_KEY, listId),
    catch: () => new Error("Failed to save last task list id to LocalStorage"),
  }).pipe(Effect.orElseSucceed(() => undefined));
}

export function getRememberedTaskListIdEffect(): Effect.Effect<string | undefined> {
  return Effect.tryPromise({
    try: async () => {
      const v = await LocalStorage.getItem<string>(LAST_TASK_LIST_ID_KEY);
      return v ?? undefined;
    },
    catch: () => new Error("Failed to read last task list id from LocalStorage"),
  }).pipe(Effect.orElseSucceed(() => undefined));
}

/** Backward-compatible Promise wrappers. */
export async function rememberTaskListId(listId: string): Promise<void> {
  return Effect.runPromise(rememberTaskListIdEffect(listId));
}

export async function getRememberedTaskListId(): Promise<string | undefined> {
  return Effect.runPromise(getRememberedTaskListIdEffect());
}
