import { getAccessToken, useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { getTaskListsEffect } from "../services/google-tasks/api";
import { runEffectPromise } from "../utils/effect-bridge";

export function useTaskLists(failureTitle = "Could not load lists") {
  const { token } = getAccessToken();
  const query = useCachedPromise(
    async (accessToken: string) => runEffectPromise(accessToken, getTaskListsEffect({ maxResults: 100 })),
    [token],
    { failureToastOptions: { title: failureTitle } },
  );
  const lists = useMemo(() => query.data?.items ?? [], [query.data]);
  return { ...query, lists };
}
