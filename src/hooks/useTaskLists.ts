import { getAccessToken, useCachedPromise } from "@raycast/utils";
import { getTaskListsEffect } from "../services/google-tasks/api";
import { runEffectPromise } from "../utils/effect-bridge";

export function useTaskLists() {
  const { token } = getAccessToken();
  return useCachedPromise(
    async (accessToken: string) => runEffectPromise(accessToken, getTaskListsEffect({ maxResults: 100 })),
    [token],
    { failureToastOptions: { title: "Could not load lists" } },
  );
}
