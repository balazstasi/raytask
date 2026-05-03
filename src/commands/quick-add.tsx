import {
  Detail,
  Toast,
  popToRoot,
  showToast,
} from "@raycast/api";
import type { LaunchProps } from "@raycast/api";
import { getAccessToken, useCachedPromise } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as api from "../services/google-tasks/api";
import { parseDueInput } from "../utils/date";
import { getRememberedTaskListId, rememberTaskListId } from "../utils/storage";
import { runEffectPromise, runEffectWithToast } from "../utils/effect-bridge";

function QuickAddInner(props: LaunchProps<{ arguments: Arguments.QuickAdd }>) {
  const { token } = getAccessToken();
  const titleArg = props.arguments.title?.trim() ?? "";
  const dueParsed = parseDueInput(props.arguments.due);

  const ran = useRef(false);
  const [busy, setBusy] = useState(true);

  const { data: listsData, isLoading: listsLoading } = useCachedPromise(
    async (accessToken: string) => runEffectPromise(accessToken, api.getTaskListsEffect({ maxResults: 100 })),
    [token],
    { failureToastOptions: { title: "Could not load lists" } },
  );

  useEffect(() => {
    if (listsLoading || ran.current) return;
    ran.current = true;

    void (async () => {
      try {
        if (!titleArg) {
          await showToast({ style: Toast.Style.Failure, title: "Title is required" });
          return;
        }

        const lists = listsData?.items ?? [];
        if (lists.length === 0) {
          await showToast({ style: Toast.Style.Failure, title: "No task lists" });
          return;
        }

        const remembered = await getRememberedTaskListId();
        const fallbackId = lists.find((l) => l.id)?.id ?? "";
        const listId = remembered && lists.some((l) => l.id === remembered) ? remembered : fallbackId;

        if (!listId) {
          await showToast({ style: Toast.Style.Failure, title: "No task list available" });
          return;
        }

        try {
          await runEffectWithToast(
            token,
            api.createTaskEffect(listId, { title: titleArg, due: dueParsed }),
            { successTitle: "Task added", errorTitle: "Could not create task" },
          );
          await rememberTaskListId(listId);
        } catch {
          /* error already toasted */
        }
      } finally {
        setBusy(false);
        await popToRoot();
      }
    })();
  }, [listsLoading, listsData, titleArg, dueParsed, token]);

  const markdown = titleArg ? `Adding **${titleArg}**…` : `# Quick Add\n\nMissing title argument.`;

  return (
    <Detail markdown={markdown} isLoading={listsLoading || busy} />
  );
}

export default function QuickAddCommand(props: LaunchProps<{ arguments: Arguments.QuickAdd }>) {
  const AuthCommand = useAuth(QuickAddInner);
  return <AuthCommand {...props} />;
}
