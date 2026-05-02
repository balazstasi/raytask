import {
  Detail,
  Toast,
  popToRoot,
  showToast,
} from "@raycast/api";
import type { LaunchProps } from "@raycast/api";
import { getAccessToken, useCachedPromise } from "@raycast/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as api from "../services/google-tasks/api";
import { parseDueInput } from "../utils/date";
import { getRememberedTaskListId, rememberTaskListId } from "../utils/storage";
import { showErrorToast } from "../utils/errors";

function QuickAddInner(props: LaunchProps<{ arguments: Arguments.QuickAdd }>) {
  const { token } = getAccessToken();
  const titleArg = props.arguments.title?.trim() ?? "";
  const dueParsed = parseDueInput(props.arguments.due);

  const ran = useRef(false);
  const [busy, setBusy] = useState(true);

  const { data: listsData, isLoading: listsLoading } = useCachedPromise(
    async (accessToken: string) => api.getTaskLists(accessToken, { maxResults: 100 }),
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

        await api.createTask(token, listId, {
          title: titleArg,
          due: dueParsed,
        });
        await rememberTaskListId(listId);
        await showToast({ style: Toast.Style.Success, title: "Task added" });
      } catch (e) {
        await showErrorToast(e, "Could not create task");
        await new Promise((r) => setTimeout(r, 2000));
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
