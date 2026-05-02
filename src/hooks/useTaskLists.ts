import { getAccessToken, useCachedPromise } from "@raycast/utils";
import { getTaskLists } from "../services/google-tasks/api";

export function useTaskLists() {
  const { token } = getAccessToken();
  return useCachedPromise(
    async (accessToken: string) => getTaskLists(accessToken, { maxResults: 100 }),
    [token],
    { failureToastOptions: { title: "Could not load lists" } },
  );
}
