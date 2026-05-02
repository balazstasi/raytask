import {
  Detail,
  Toast,
  getPreferenceValues,
  popToRoot,
  showToast,
} from "@raycast/api";
import type { LaunchProps } from "@raycast/api";
import { getAccessToken, useCachedPromise, withAccessToken } from "@raycast/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import { createGoogleOAuthService } from "./google-auth";
import { parseDueInput } from "./parse-due-input";
import { getRememberedTaskListId, rememberTaskListId } from "./storage";
import { showErrorToast } from "./error-utils";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SetupView } from "./setup-view";

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
    <ErrorBoundary>
      <Detail markdown={markdown} isLoading={listsLoading || busy} />
    </ErrorBoundary>
  );
}

export default function QuickAddCommand(props: LaunchProps<{ arguments: Arguments.QuickAdd }>) {
  const { googleClientId } = getPreferenceValues<Preferences>();
  const trimmed = (googleClientId ?? "").trim();
  const oauthService = useMemo(
    () => (trimmed.length > 0 ? createGoogleOAuthService(trimmed) : null),
    [trimmed],
  );

  if (!oauthService) {
    return <SetupView />;
  }

  const Authorized = useMemo(() => withAccessToken(oauthService)(QuickAddInner), [oauthService]);

  return <Authorized {...props} />;
}
