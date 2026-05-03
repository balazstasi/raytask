import { Action, ActionPanel, Icon, Keyboard, List, useNavigation } from "@raycast/api";
import { getAccessToken, useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { getTaskListsEffect } from "../services/google-tasks/api";
import { runEffectPromise } from "../utils/effect-bridge";
import { rememberTaskListId } from "../utils/storage";
import { TasksView } from "./TasksView";

export function TaskListsView() {
  const { push } = useNavigation();
  const { token } = getAccessToken();

  const {
    isLoading,
    data: listsData,
    revalidate: revalidateLists,
  } = useCachedPromise(
    async (accessToken: string) => runEffectPromise(getTaskListsEffect(accessToken, { maxResults: 100 })),
    [token],
    {
      failureToastOptions: {
        title: "Could not load task lists",
      },
    },
  );

  const taskLists = useMemo(() => listsData?.items ?? [], [listsData]);

  return (
    <List
      navigationTitle="Google Tasks"
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action title="Reload" icon={Icon.ArrowClockwise} onAction={() => void revalidateLists()} />
        </ActionPanel>
      }
    >
      {taskLists.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Tray}
          title="No task lists"
          description="Create a list in Google Tasks, then reload."
          actions={
            <ActionPanel>
              <Action title="Reload" icon={Icon.ArrowClockwise} onAction={() => void revalidateLists()} />
            </ActionPanel>
          }
        />
      ) : (
        taskLists.map((list) => (
          <List.Item
            key={list.id ?? list.title}
            icon={Icon.List}
            title={list.title || "Untitled list"}
            subtitle={list.updated ? `Updated ${new Date(list.updated).toLocaleDateString()}` : undefined}
            actions={
              <ActionPanel>
                <Action
                  title="Open List"
                  icon={Icon.ChevronRight}
                  onAction={() => {
                    if (list.id) {
                      void rememberTaskListId(list.id);
                    }
                    push(
                      <TasksView taskList={list} allLists={taskLists} onListsChanged={() => void revalidateLists()} />,
                      () => void revalidateLists(),
                    );
                  }}
                  shortcut={Keyboard.Shortcut.Common.Open}
                />
                <Action title="Reload" icon={Icon.ArrowClockwise} onAction={() => void revalidateLists()} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
