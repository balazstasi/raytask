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
import * as api from "../api";
import { EditTaskForm } from "../components/EditTaskForm";
import { looksLikeDailyRepeatTask } from "../menu-bar-task-filter";
import { moveTaskToAnotherList } from "../move-task";
import { buildTaskDetailMarkdown, formatTaskSubtitle, matchesTaskSearch } from "../task-format";
import { getTasksParamsForFilter, taskFilterLabel, type TaskFilter } from "../task-filters";
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
      return api.getTasks(accessToken, listId, params);
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

  const tasksVisible = useMemo(() => {
    return tasksFilteredByMode.filter((t) => matchesTaskSearch(t, searchText));
  }, [tasksFilteredByMode, searchText]);

  const otherLists = useMemo(
    () => allLists.filter((l) => l.id && l.id !== taskListId),
    [allLists, taskListId],
  );

  async function toggleComplete(task: Task) {
    if (!task.id) return;
    try {
      if (task.status === "completed") {
        await api.patchTask(token, taskListId, task.id, { status: "needsAction" });
      } else {
        await api.completeTask(token, taskListId, task.id);
      }
      await showToast({ style: Toast.Style.Success, title: "Updated" });
      await revalidateTasks();
      onListsChanged?.();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not update task",
        message: e instanceof Error ? e.message : String(e),
      });
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
    try {
      await api.deleteTask(token, taskListId, task.id);
      await showToast({ style: Toast.Style.Success, title: "Deleted" });
      await revalidateTasks();
      onListsChanged?.();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not delete task",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function moveTo(task: Task, targetListId: string) {
    if (!task.id || targetListId === taskListId) return;
    try {
      await moveTaskToAnotherList(token, taskListId, targetListId, task);
      await showToast({ style: Toast.Style.Success, title: "Moved" });
      await revalidateTasks();
      onListsChanged?.();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not move task",
        message: e instanceof Error ? e.message : String(e),
      });
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
        tasksVisible.map((task) => (
          <List.Item
            key={task.id ?? `${task.title}-${task.position}`}
            id={task.id}
            icon={task.status === "completed" ? Icon.Checkmark : Icon.Circle}
            title={task.title ?? "(No title)"}
            subtitle={formatTaskSubtitle(task)}
            accessories={task.notes ? [{ icon: Icon.TextDocument, tooltip: task.notes }] : undefined}
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
                        markdown={buildTaskDetailMarkdown(task)}
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
                        onSaved={() => {
                          void revalidateTasks();
                          onListsChanged?.();
                        }}
                      />,
                    )
                  }
                  shortcut={{ modifiers: ["cmd"], key: "e" }}
                />
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
        ))
      )}
    </List>
  );
}
