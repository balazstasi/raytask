import {
  Action,
  ActionPanel,
  Icon,
  List,
  getPreferenceValues,
  useNavigation,
} from "@raycast/api";
import { getAccessToken, useCachedPromise, withAccessToken } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import * as api from "./api";
import { EditTaskForm } from "./components/EditTaskForm";
import { createGoogleOAuthService } from "./google-auth";
import { getRememberedTaskListId, rememberTaskListId } from "./storage";
import { formatTaskSubtitle, matchesTaskSearch } from "./task-format";
import { SetupView } from "./setup-view";

function EditTaskAuthenticatedView() {
  const { token } = getAccessToken();
  const { push } = useNavigation();
  const [listId, setListId] = useState("");
  const [searchText, setSearchText] = useState("");

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

  useEffect(() => {
    if (listsLoading || lists.length === 0 || listId) return;
    void (async () => {
      const remembered = await getRememberedTaskListId();
      const preferred =
        remembered && lists.some((l) => l.id === remembered) ? remembered : (lists.find((l) => l.id)?.id ?? "");
      setListId(preferred);
    })();
  }, [listsLoading, lists, listId]);

  const {
    data: tasksData,
    isLoading: tasksLoading,
    revalidate: revalidateTasks,
  } = useCachedPromise(
    async (accessToken: string, lid: string) => {
      if (!lid) return { items: [] };
      return api.getTasks(accessToken, lid, { maxResults: 100, showCompleted: true });
    },
    [token, listId],
    { execute: listId.length > 0, failureToastOptions: { title: "Could not load tasks" } },
  );

  const tasks = tasksData?.items ?? [];
  const visibleTasks = tasks.filter((t) => matchesTaskSearch(t, searchText));

  const listsWithIds = lists.filter((l) => l.id);

  const listAccessory =
    listsWithIds.length > 0 && listId ? (
      <List.Dropdown
        tooltip="Task list"
        value={listId}
        onChange={(v) => {
          setListId(v);
          void rememberTaskListId(v);
        }}
      >
        {listsWithIds.map((l) => (
          <List.Dropdown.Item key={l.id} value={l.id!} title={l.title ?? "Untitled"} />
        ))}
      </List.Dropdown>
    ) : null;

  const resolvingList = listsWithIds.length > 0 && !listId && !listsLoading;

  return (
    <List
      navigationTitle="Edit Task"
      isLoading={listsLoading || resolvingList || (listId.length > 0 && tasksLoading)}
      searchBarPlaceholder="Search tasks"
      filtering={false}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarAccessory={listAccessory}
      actions={
        <ActionPanel>
          <Action
            title="Reload"
            icon={Icon.ArrowClockwise}
            onAction={() => {
              void revalidateLists();
              void revalidateTasks();
            }}
          />
        </ActionPanel>
      }
    >
      {!listsLoading && lists.length === 0 ? (
        <List.EmptyView icon={Icon.Tray} title="No lists" description="Create a list in Google Tasks first." />
      ) : !tasksLoading && listId && visibleTasks.length === 0 ? (
        <List.EmptyView icon={Icon.Tray} title="No matching tasks" />
      ) : (
        visibleTasks.map((task) => (
          <List.Item
            key={task.id ?? task.title}
            icon={task.status === "completed" ? Icon.Checkmark : Icon.Circle}
            title={task.title ?? "(No title)"}
            subtitle={formatTaskSubtitle(task)}
            actions={
              <ActionPanel>
                <Action
                  title="Edit"
                  icon={Icon.Pencil}
                  onAction={() =>
                    push(
                      <EditTaskForm
                        taskListId={listId}
                        task={task}
                        lists={lists}
                        onSaved={() => void revalidateTasks()}
                      />,
                    )
                  }
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}

function EditWrapper() {
  return <EditTaskAuthenticatedView />;
}

export default function EditTaskCommand() {
  const { googleClientId } = getPreferenceValues<Preferences>();
  const trimmed = (googleClientId ?? "").trim();
  const oauthService = useMemo(
    () => (trimmed.length > 0 ? createGoogleOAuthService(trimmed) : null),
    [trimmed],
  );

  if (!oauthService) {
    return <SetupView />;
  }

  const Authorized = useMemo(() => withAccessToken(oauthService)(EditWrapper), [oauthService]);

  return <Authorized />;
}
