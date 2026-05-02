import { LocalStorage } from "@raycast/api";

export const LAST_TASK_LIST_ID_KEY = "raytask.lastTaskListId";

export async function rememberTaskListId(listId: string): Promise<void> {
  try {
    await LocalStorage.setItem(LAST_TASK_LIST_ID_KEY, listId);
  } catch {
    console.error("Failed to save last task list id to LocalStorage");
  }
}

export async function getRememberedTaskListId(): Promise<string | undefined> {
  try {
    const v = await LocalStorage.getItem<string>(LAST_TASK_LIST_ID_KEY);
    return v ?? undefined;
  } catch {
    console.error("Failed to read last task list id from LocalStorage");
    return undefined;
  }
}
