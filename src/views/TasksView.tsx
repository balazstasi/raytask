import {
  Action,
  ActionPanel,
  Alert,
  Detail,
  Icon,
  List,
  Toast,
  confirmAlert,
  showToast,
  useNavigation,
} from "@raycast/api";
import { getAccessToken, useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import * as api from "../services/google-tasks/api";
import { CreateTaskForm } from "../components/CreateTaskForm";
import { EditTaskForm } from "../components/EditTaskForm";
import { looksLikeDailyRepeatTask } from "../domain/menu-bar-filter";
import { moveTaskToAnotherListEffect } from "../domain/move";
import { buildTaskDetailMarkdown, formatTaskRowSubtitle, matchesTaskSearch } from "../domain/format";
import { directChildCountsInSet, formatHierarchyListTitle, indexTasksById, orderTasksForList, resolvedParentDisplayTitle } from "../domain/hierarchy";
import { getTasksParamsForFilter, taskFilterLabel, type TaskFilter } from "../domain/filters";
import { runEffectPromise, runEffectWithToast } from "../utils/effect-bridge";
import type { Task, TaskList } from "../types";

export type TasksViewProps = {
  taskList: TaskList;
  allLists: TaskList[];
  /** Call when returning so root can refresh list metadata */
  onListsChanged?: () => void;
};

export function TasksView({ taskList, allLists, onListsChanged }: TasksViewProps) {
  const { push, pop } = useNavigation();
  const { token } = getAccessToken();
  const taskListId = taskList.id ?? "";

  const [filter, setFilter] = useState<TaskFilter>("all");
  const [searchText, setSearchText] = useState("");

  const listParams = useMemo(() => getTasksParamsForFilter(filter), [filter]);

  const {
    isLoading,
    data: tasksData,
    revalidate: revalidateTasks,
  } = useCachedPromise(
    async (accessToken: string, listId: string, params: ReturnType<typeof getTasksParamsForFilter>) => {
      if (!listId) {
        return { items: [] };
      }
      return runEffectPromise(api.getTasksEffect(accessToken, listId, params));
    },
    [token, taskListId, listParams],
    {
      execute: taskListId.length > 0,
      failureToastOptions: {
        title: "Could not load tasks",
      },
    },
  );

  const tasksRaw = tasksData?.items ?? [];

  const tasksFilteredByMode = useMemo(() => {
    if (filter === "completed") {
      return tasksRaw.filter((t) => t.status === "completed");
    }
    return tasksRaw;
  }, [tasksRaw, filter]);

  const taskByIdForFilterScope = useMemo(() => indexTasksById(tasksFilteredByMode), [tasksFilteredByMode]);
  const idsInFilterScope = useMemo(
    () => new Set(tasksFilteredByMode.flatMap((t) => (t.id ? [t.id] : []))),
    [tasksFilteredByMode],
  );

  const tasksVisible = useMemo(() => {
    return tasksFilteredByMode.filter((t) => matchesTaskSearch(t, searchText, taskByIdForFilterScope));
  }, [tasksFilteredByMode, searchText, taskByIdForFilterScope]);

  const tasksRowsOrdered = useMemo(() => orderTasksForList(tasksVisible), [tasksVisible]);
  const visibleChildCounts = useMemo(() => directChildCountsInSet(tasksVisible), [tasksVisible]);

  const otherLists = useMemo(
    () => allLists.filter((l) => l.id && l.id !== taskListId),
    [allLists, taskListId],
  );

  async function toggleComplete(task: Task) {
    if (!task.id) return;
    const effect =
      task.status === "completed"
        ? api.patchTaskEffect(token, taskListId, task.id, { status: "needsAction" })
        : api.completeTaskEffect(token, taskListId, task.id);

    const result = await runEffectWithToast(effect, { successTitle: "Updated", errorTitle: "Could not update task" });
    if (result !== undefined) {
      await revalidateTasks();
      onListsChanged?.();
    }
  }

  async function removeTask(task: Task) {
    if (!task.id) return;
    const repeatingCaveat = looksLikeDailyRepeatTask(task)
      ? `\n\nThis may only remove today's instance if the task repeats in Google Tasks. To delete the whole series or turn off repeat, use "Open in Google Tasks".`
      : "";
    const ok = await confirmAlert({
      title: "Delete this task?",
      message: `${task.title ?? ""}${repeatingCaveat}`,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!ok) return;
    const result = await runEffectWithToast(api.deleteTaskEffect(token, taskListId, task.id), {
      successTitle: "Deleted",
      errorTitle: "Could not delete task",
    });
    if (result !== undefined) {
      await revalidateTasks();
      onListsChanged?.();
    }
  }

  async function moveTo(task: Task, targetListId: string) {
    if (!task.id || targetListId === taskListId) return;
    const result = await runEffectWithToast(
      moveTaskToAnotherListEffect(token, taskListId, targetListId, task),
      { successTitle: "Moved", errorTitle: "Could not move task" },
    );
    if (result !== undefined) {
      await revalidateTasks();
      onListsChanged?.();
    }
  }

  const filterAccessory = (
    <List.Dropdown
      tooltip="Filter"
      value={filter}
      onChange={(v) => setFilter(v as TaskFilter)}
      storeValue
    >
      <List.Dropdown.Item value="all" title={taskFilterLabel("all")} />
      <List.Dropdown.Item value="today" title={taskFilterLabel("today")} />
      <List.Dropdown.Item value="upcoming" title={taskFilterLabel("upcoming")} />
      <List.Dropdown.Item value="completed" title={taskFilterLabel("completed")} />
    </List.Dropdown>
  );

  return (
    <List
      navigationTitle={taskList.title ?? "Tasks"}
      isLoading={isLoading}
      searchBarPlaceholder="Search title or notes"
      filtering={false}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarAccessory={filterAccessory}
      actions={
        <ActionPanel>
          <Action title="Back" icon={Icon.ArrowLeft} onAction={() => pop()} shortcut={{ modifiers: ["cmd"], key: "[" }} />
          <Action title="Reload" icon={Icon.ArrowClockwise} onAction={() => void revalidateTasks()} />
        </ActionPanel>
      }
    >
      {tasksVisible.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Tray}
          title="No tasks match"
          description="Try another filter or search query."
          actions={
            <ActionPanel>
              <Action title="Reload" icon={Icon.ArrowClockwise} onAction={() => void revalidateTasks()} />
            </ActionPanel>
          }
        />
      ) : (
        tasksRowsOrdered.map(({ task, depth }) => {
          const rowAccessories = [
            ...(task.id && (visibleChildCounts.get(task.id) ?? 0) > 0 ?
              [
                  {
                    icon: Icon.List,
                    tag: String(visibleChildCounts.get(task.id)),
                    tooltip: "Subtasks in this list/search",
                  },
                ]
              : []),
            ...(task.notes ? [{ icon: Icon.TextDocument, tooltip: task.notes }] : []),
          ];

          return (
          <List.Item
            key={task.id ?? `${task.title}-${task.position}`}
            id={task.id}
            icon={task.status === "completed" ? Icon.Checkmark : Icon.Circle}
            title={formatHierarchyListTitle(depth, task.title ?? "")}
            subtitle={formatTaskRowSubtitle(
              task,
              resolvedParentDisplayTitle(task, taskByIdForFilterScope, idsInFilterScope),
            )}
            accessories={rowAccessories.length > 0 ? rowAccessories : undefined}
            actions={
              <ActionPanel>
                <Action
                  title={task.status === "completed" ? "Mark Open" : "Complete"}
                  icon={task.status === "completed" ? Icon.Circle : Icon.Checkmark}
                  onAction={() => void toggleComplete(task)}
                  shortcut={{ modifiers: ["cmd"], key: "enter" }}
                />
                <Action
                  title="Show Details"
                  icon={Icon.Info}
                  onAction={() =>
                    push(
                      <Detail
                        navigationTitle={task.title ?? "Task"}
                        markdown={buildTaskDetailMarkdown(task, tasksFilteredByMode)}
                        actions={
                          <ActionPanel>
                            <Action title="Back" icon={Icon.ArrowLeft} onAction={() => pop()} />
                            {task.webViewLink ? (
                              <Action.OpenInBrowser title="Open in Google Tasks" url={task.webViewLink} />
                            ) : null}
                          </ActionPanel>
                        }
                      />,
                    )
                  }
                />
                {task.webViewLink ? (
                  <Action.OpenInBrowser title="Open in Google Tasks" url={task.webViewLink} />
                ) : null}
                <Action
                  title="Edit"
                  icon={Icon.Pencil}
                  onAction={() =>
                    push(
                      <EditTaskForm
                        taskListId={taskListId}
                        task={task}
                        lists={allLists}
                        relationshipContext={tasksFilteredByMode}
                        onSaved={() => {
                          void revalidateTasks();
                          onListsChanged?.();
                        }}
                      />,
                    )
                  }
                  shortcut={{ modifiers: ["cmd"], key: "e" }}
                />
                {!task.parent && task.id ? (
                  <Action
                    title="Add Subtask"
                    icon={Icon.PlusCircle}
                    shortcut={{ modifiers: ["shift", "cmd"], key: "n" }}
                    onAction={() =>
                      push(
                        <CreateTaskForm
                          lists={allLists}
                          initialListId={taskListId}
                          lockedParent={{
                            id: task.id!,
                            title: task.title ?? "(No title)",
                          }}
                          onSaved={() => {
                            void revalidateTasks();
                            onListsChanged?.();
                          }}
                        />,
                      )
                    }
                  />
                ) : null}
                <ActionPanel.Section title="Move">
                  {otherLists.map((l) => (
                    <Action
                      key={l.id}
                      title={`Move to ${l.title ?? "List"}`}
                      icon={Icon.ArrowRight}
                      onAction={() => void moveTo(task, l.id!)}
                    />
                  ))}
                </ActionPanel.Section>
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={() => void removeTask(task)}
                  shortcut={{ modifiers: ["ctrl"], key: "x" }}
                />
              </ActionPanel>
            }
          />
          );
        })
      )}
    </List>
  );
}
