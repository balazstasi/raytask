import { LocalStorage } from "@raycast/api";

export const LAST_TASK_LIST_ID_KEY = "raytask.lastTaskListId";

export async function rememberTaskListId(listId: string): Promise<void> {
  await LocalStorage.setItem(LAST_TASK_LIST_ID_KEY, listId);
}

export async function getRememberedTaskListId(): Promise<string | undefined> {
  const v = await LocalStorage.getItem<string>(LAST_TASK_LIST_ID_KEY);
  return v ?? undefined;
}
