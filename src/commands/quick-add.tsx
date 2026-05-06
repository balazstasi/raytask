import { Detail, Toast, popToRoot, showToast } from "@raycast/api";
import type { LaunchProps } from "@raycast/api";
import { getAccessToken } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTaskLists } from "../hooks/useTaskLists";
import * as api from "../services/google-tasks/api";
import { parseDueInput } from "../utils/date";
import { getRememberedTaskListId, rememberTaskListId } from "../utils/storage";
import { runEffectWithToast } from "../utils/effect-bridge";

function QuickAddInner(props: LaunchProps<{ arguments: Arguments.QuickAdd }>) {
  const { token } = getAccessToken();
  const titleArg = props.arguments.title?.trim() ?? "";
  const dueInput = props.arguments.due?.trim() ?? "";
  const dueParsed = dueInput ? parseDueInput(dueInput) : undefined;

  const ran = useRef(false);
  const [busy, setBusy] = useState(true);
  const { lists, isLoading: listsLoading } = useTaskLists();

  useEffect(() => {
    if (listsLoading || ran.current) return;
    ran.current = true;

    void (async () => {
      try {
        if (!titleArg) {
          await showToast({ style: Toast.Style.Failure, title: "Title is required" });
          return;
        }

        if (dueInput && !dueParsed) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Could not parse due date",
            message: "Try a phrase like “tomorrow” or a calendar date like 2026-05-15 (dates only; time is not saved).",
          });
          return;
        }

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
  }, [dueInput, dueParsed, listsLoading, lists, titleArg, token]);

  const markdown = titleArg ? `Adding **${titleArg}**…` : `# Quick Add\n\nMissing title argument.`;

  return (
    <Detail markdown={markdown} isLoading={listsLoading || busy} />
  );
}

export default function QuickAddCommand(props: LaunchProps<{ arguments: Arguments.QuickAdd }>) {
  const AuthCommand = useAuth(QuickAddInner);
  return <AuthCommand {...props} />;
}
