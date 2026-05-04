import {
  Icon,
  MenuBarExtra,
  launchCommand,
  LaunchType,
  openExtensionPreferences,
} from "@raycast/api";
import { getAccessToken, useCachedPromise } from "@raycast/utils";
import { useCallback, useMemo } from "react";
import {
  menuBarRowSubtitle,
  sortTasksForMenuBarToday,
  taskMatchesMenuBarTodayAgenda,
  todayLocalCalendarDate,
} from "../domain/menu-bar-filter";
import { useTaskLists } from "../hooks/useTaskLists";
import { getRememberedTaskListId } from "../utils/storage";
import { indexTasksById, resolvedParentDisplayTitle } from "../domain/hierarchy";
import { runEffectWithToast, runEffectPromise } from "../utils/effect-bridge";
import { getTasksAllPagesEffect, getTasksEffect, patchTaskEffect, completeTaskEffect } from "../services/google-tasks/api";
import type { Task, TaskList } from "../services/google-tasks/schema";

async function resolveDefaultListId(lists: TaskList[]): Promise<string> {
  const remembered = await getRememberedTaskListId();
  if (remembered && lists.some((l) => l.id === remembered)) {
    return remembered;
  }
  return lists.find((l) => l.id)?.id ?? "";
}

function endOfTodayLocalIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
}

function dedupeTasks(tasks: Task[]): Task[] {
  return [...new Map(tasks.map((task) => [task.id, task])).values()];
}

export function MenuBarView() {
  const { token } = getAccessToken();
  const { lists, isLoading: listsLoading, revalidate: revalidateLists } = useTaskLists();

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

      const [dueTasks, dailyRepeatCandidates] = await Promise.all([
        runEffectPromise(
          accessToken,
          getTasksAllPagesEffect(lid, {
            maxResults: 100,
            dueMax: endOfTodayLocalIso(),
            showCompleted: true,
            showHidden: true,
          }),
        ),
        runEffectPromise(
          accessToken,
          getTasksEffect(lid, {
            maxResults: 100,
            showCompleted: false,
            showHidden: false,
          }),
        ),
      ]);

      return { items: dedupeTasks([...dueTasks, ...(dailyRepeatCandidates.items ?? [])]) };
    },
    [token, listId],
    {
      execute: listId.length > 0,
      failureToastOptions: { title: "Could not load tasks" },
    },
  );

  const tasks = tasksData?.items ?? [];

  const tasksByIdMenu = useMemo(() => indexTasksById(tasks), [tasks]);
  const taskIdsMenu = useMemo(
    () => new Set(tasks.flatMap((t) => (t.id ? [t.id] : []))),
    [tasks],
  );

  const agendaToday = todayLocalCalendarDate();

  /** Bounded fetch for due/overdue work, plus a small undated scan for daily-repeat hints (API exposes no recurrence). */
  const todayTasksOrdered = useMemo(() => {
    const filtered = tasks.filter((t) => taskMatchesMenuBarTodayAgenda(t, agendaToday));
    filtered.sort((a, b) => sortTasksForMenuBarToday(a, b, agendaToday));
    return filtered.slice(0, 25);
  }, [tasks, agendaToday]);

  const toggleTaskDone = useCallback(
    async (task: Task) => {
      if (!task.id || !listId) return;
      const done = task.status === "completed";
      const effect = done
        ? patchTaskEffect(listId, task.id, { status: "needsAction" })
        : completeTaskEffect(listId, task.id);
      try {
        await runEffectWithToast(token, effect, {
          errorTitle: done ? "Could not reopen task" : "Could not complete task",
        });
        await revalidateTasks();
      } catch {
        /* error already toasted */
      }
    },
    [token, listId, revalidateTasks],
  );

  const loading =
    listsLoading || defaultListQuery.isLoading || (listId.length > 0 && tasksLoading);

  return (
    <MenuBarExtra icon={Icon.CircleFilled} isLoading={loading} tooltip="RayTask · Today & overdue">
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
              title={t.parent ? `↳ ${t.title ?? "(No title)"}` : (t.title ?? "(No title)")}
              subtitle={menuBarRowSubtitle(t, agendaToday, resolvedParentDisplayTitle(t, tasksByIdMenu, taskIdsMenu))}
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
