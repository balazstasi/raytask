import {
  Icon,
  MenuBarExtra,
  Toast,
  getPreferenceValues,
  launchCommand,
  LaunchType,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { getAccessToken, useCachedPromise, withAccessToken } from "@raycast/utils";
import { useCallback, useMemo } from "react";
import * as api from "./api";
import { createGoogleOAuthService } from "./google-auth";
import {
  menuBarRowSubtitle,
  sortTasksForMenuBarToday,
  taskMatchesMenuBarTodayAgenda,
  todayLocalCalendarDate,
} from "./menu-bar-task-filter";
import { getRememberedTaskListId } from "./storage";
import type { Task, TaskList } from "./types";

async function resolveDefaultListId(lists: TaskList[]): Promise<string> {
  const remembered = await getRememberedTaskListId();
  if (remembered && lists.some((l) => l.id === remembered)) {
    return remembered;
  }
  return lists.find((l) => l.id)?.id ?? "";
}

function MenuBarView() {
  const { token } = getAccessToken();

  const {
    data: listsData,
    isLoading: listsLoading,
    revalidate: revalidateLists,
  } = useCachedPromise(
    async (accessToken: string) => api.getTaskLists(accessToken, { maxResults: 100 }),
    [token],
    { failureToastOptions: { title: "Could not load lists" } },
  );

  const lists = useMemo(() => listsData?.items ?? [], [listsData]);

  const defaultListQuery = useCachedPromise(
    async (_accessToken: string, loadedLists: TaskList[]) => resolveDefaultListId(loadedLists),
    [token, lists],
    {
      execute: !listsLoading && lists.length > 0,
    },
  );

  const listId = defaultListQuery.data ?? "";

  const {
    data: tasksData,
    isLoading: tasksLoading,
    revalidate: revalidateTasks,
  } = useCachedPromise(
    async (accessToken: string, lid: string) => {
      if (!lid) return { items: [] as Task[] };
      const items = await api.getTasksAllPages(accessToken, lid, {
        maxResults: 100,
        showCompleted: true,
        showHidden: true,
      });
      return { items };
    },
    [token, listId],
    {
      execute: listId.length > 0,
      failureToastOptions: { title: "Could not load tasks" },
    },
  );

  const tasks = tasksData?.items ?? [];

  const agendaToday = todayLocalCalendarDate();

  /** Broad fetch + client filter: due ≤ today (calendar), plus daily-repeat hints without due (API has no RRULE). */
  const todayTasksOrdered = useMemo(() => {
    const filtered = tasks.filter((t) => taskMatchesMenuBarTodayAgenda(t, agendaToday));
    filtered.sort((a, b) => sortTasksForMenuBarToday(a, b, agendaToday));
    return filtered.slice(0, 25);
  }, [tasks, agendaToday]);

  const toggleTaskDone = useCallback(
    async (task: Task) => {
      if (!task.id || !listId) return;
      const done = task.status === "completed";
      try {
        if (done) {
          await api.patchTask(token, listId, task.id, { status: "needsAction" });
        } else {
          await api.completeTask(token, listId, task.id);
        }
        await revalidateTasks();
      } catch (e) {
        await showToast({
          style: Toast.Style.Failure,
          title: done ? "Could not reopen task" : "Could not complete task",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [token, listId, revalidateTasks],
  );

  const loading =
    listsLoading || defaultListQuery.isLoading || (listId.length > 0 && tasksLoading);

  return (
    <MenuBarExtra icon="icon.png" isLoading={loading} tooltip="RayTask · Today & overdue">
      <MenuBarExtra.Item
        title="Open Google Tasks"
        onAction={() => launchCommand({ name: "index", type: LaunchType.UserInitiated })}
      />
      <MenuBarExtra.Item
        title="Reload"
        onAction={() =>
          void (async () => {
            await revalidateLists();
            await defaultListQuery.revalidate();
            await revalidateTasks();
          })()
        }
      />
      <MenuBarExtra.Separator />
      {lists.length === 0 && !listsLoading ? (
        <MenuBarExtra.Item title="No lists — open preferences" onAction={() => openExtensionPreferences()} />
      ) : todayTasksOrdered.length === 0 ? (
        <MenuBarExtra.Item title="Nothing due today or overdue" />
      ) : (
        todayTasksOrdered.map((t) => {
          const completed = t.status === "completed";
          return (
            <MenuBarExtra.Item
              key={t.id}
              icon={completed ? Icon.Checkmark : Icon.Circle}
              title={t.title ?? "(No title)"}
              subtitle={menuBarRowSubtitle(t, agendaToday)}
              tooltip={
                completed
                  ? "Completed — click to reopen"
                  : "Mark complete (due today, overdue, or daily habit match)"
              }
              onAction={() => void toggleTaskDone(t)}
            />
          );
        })
      )}
    </MenuBarExtra>
  );
}

function MenuBarWrapper() {
  return <MenuBarView />;
}

export default function MenuBarCommand() {
  const { googleClientId } = getPreferenceValues<Preferences>();
  const trimmed = (googleClientId ?? "").trim();
  const oauthService = useMemo(
    () => (trimmed.length > 0 ? createGoogleOAuthService(trimmed) : null),
    [trimmed],
  );

  if (!oauthService) {
    return (
      <MenuBarExtra icon="icon.png" tooltip="RayTask">
        <MenuBarExtra.Item title="Set OAuth Client ID…" onAction={() => openExtensionPreferences()} />
      </MenuBarExtra>
    );
  }

  const Authorized = useMemo(
    () => withAccessToken(oauthService)(MenuBarWrapper),
    [oauthService],
  );

  return <Authorized />;
}
