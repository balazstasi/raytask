import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  List,
  getPreferenceValues,
  openExtensionPreferences,
} from "@raycast/api";
import { getAccessToken, useCachedPromise, withAccessToken } from "@raycast/utils";
import { useMemo } from "react";
import * as api from "./api";
import { createGoogleOAuthService } from "./google-auth";
import type { Task } from "./types";

const setupMarkdown = `
# Connect Google Tasks

Before you can use RayTask, add your **Google OAuth Client ID** in extension preferences.

## Steps

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and select your project.
2. Enable the **Google Tasks API** if you have not already.
3. Configure the OAuth consent screen and add the scope \`https://www.googleapis.com/auth/tasks\`.
4. Create an OAuth client ID: type **iOS**, **Bundle ID** \`com.raycast\` (see the [Raycast guide](https://developers.raycast.com/utilities/oauth/getting-google-client-id)).
5. Copy the **Client ID** and paste it below via **Open Extension Preferences**.

Register the redirect URI Google expects for Raycast: \`com.raycast:/oauth?package_name=raytask\` if the console asks for it.
`.trim();

function SetupView() {
  return (
    <Detail
      markdown={setupMarkdown}
      actions={
        <ActionPanel>
          <Action title="Open Extension Preferences" onAction={() => openExtensionPreferences()} />
        </ActionPanel>
      }
    />
  );
}

function formatTaskSubtitle(task: Task): string | undefined {
  const parts: string[] = [];
  if (task.status === "completed") {
    parts.push("Completed");
  }
  if (task.due) {
    try {
      parts.push(new Date(task.due).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
    } catch {
      parts.push(task.due);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function AuthenticatedView() {
  const { token } = getAccessToken();

  const {
    isLoading: listsLoading,
    data: listsData,
    revalidate: revalidateLists,
  } = useCachedPromise(
    async (accessToken: string) => api.getTaskLists(accessToken, { maxResults: 100 }),
    [token],
    {
      failureToastOptions: {
        title: "Could not load task lists",
      },
    },
  );

  const taskLists = listsData?.items ?? [];
  const primaryList = taskLists.find((l) => l.id) ?? null;
  const primaryListId = primaryList?.id ?? "";

  const {
    isLoading: tasksLoading,
    data: tasksData,
    revalidate: revalidateTasks,
  } = useCachedPromise(
    async (accessToken: string, listId: string) => {
      if (!listId) {
        return { items: [] };
      }
      return api.getTasks(accessToken, listId, {
        maxResults: 60,
        showCompleted: true,
      });
    },
    [token, primaryListId],
    {
      execute: primaryListId.length > 0,
      failureToastOptions: {
        title: "Could not load tasks",
      },
    },
  );

  const tasks = tasksData?.items ?? [];

  const isLoading = listsLoading || (primaryListId.length > 0 && tasksLoading);

  const reload = () => {
    revalidateLists();
    revalidateTasks();
  };

  return (
    <List
      navigationTitle="Google Tasks"
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action title="Reload" icon={Icon.ArrowClockwise} onAction={reload} />
        </ActionPanel>
      }
    >
      {taskLists.length === 0 && !listsLoading ? (
        <List.EmptyView
          icon={Icon.Tray}
          title="No task lists"
          description="Create a list in Google Tasks, then reload."
          actions={
            <ActionPanel>
              <Action title="Reload" icon={Icon.ArrowClockwise} onAction={reload} />
            </ActionPanel>
          }
        />
      ) : (
        <List.Section title="Task lists">
          {taskLists.map((list) => (
            <List.Item
              key={list.id ?? list.title}
              icon={Icon.List}
              title={list.title || "Untitled list"}
              subtitle={list.id === primaryListId ? "Showing tasks below" : undefined}
              actions={
                <ActionPanel>
                  <Action title="Reload" icon={Icon.ArrowClockwise} onAction={reload} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {primaryList && (
        <List.Section title={`Tasks — ${primaryList.title ?? "Untitled list"}`}>
          {tasks.length === 0 && !tasksLoading ? (
            <List.Item
              icon={Icon.Tray}
              title="No tasks in this list"
              subtitle="Add tasks in Google Tasks or reload."
              actions={
                <ActionPanel>
                  <Action title="Reload" icon={Icon.ArrowClockwise} onAction={reload} />
                </ActionPanel>
              }
            />
          ) : (
            tasks.map((task) => (
              <List.Item
                key={task.id ?? task.title}
                icon={task.status === "completed" ? Icon.Checkmark : Icon.Circle}
                title={task.title ?? "(No title)"}
                subtitle={formatTaskSubtitle(task)}
                accessories={task.notes ? [{ icon: Icon.TextDocument, tooltip: task.notes }] : undefined}
                actions={
                  <ActionPanel>
                    <Action title="Reload" icon={Icon.ArrowClockwise} onAction={reload} />
                  </ActionPanel>
                }
              />
            ))
          )}
        </List.Section>
      )}
    </List>
  );
}

export default function Command() {
  const { googleClientId } = getPreferenceValues<Preferences>();
  const trimmed = (googleClientId ?? "").trim();

  const oauthService = useMemo(
    () => (trimmed.length > 0 ? createGoogleOAuthService(trimmed) : null),
    [trimmed],
  );

  const AuthorizedMain = useMemo(() => {
    if (!oauthService) {
      return null;
    }
    return withAccessToken(oauthService)(AuthenticatedView);
  }, [oauthService]);

  if (!AuthorizedMain) {
    return <SetupView />;
  }

  return <AuthorizedMain />;
}
