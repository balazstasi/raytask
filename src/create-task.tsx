import {
  Action,
  ActionPanel,
  Form,
  Icon,
  Toast,
  getPreferenceValues,
  showToast,
  useNavigation,
} from "@raycast/api";
import { getAccessToken, useCachedPromise, withAccessToken } from "@raycast/utils";
import { useMemo, useState } from "react";
import * as api from "./api";
import { createGoogleOAuthService } from "./google-auth";
import { dateToDueRFC3339, parseDueInput } from "./parse-due-input";
import { rememberTaskListId } from "./storage";
import { SetupView } from "./setup-view";
import type { TaskList } from "./types";

function CreateTaskForm({ lists }: { lists: TaskList[] }) {
  const { token } = getAccessToken();
  const { pop } = useNavigation();

  const defaultListId = lists.find((l) => l.id)?.id ?? "";
  const [listId, setListId] = useState(defaultListId);

  const { data: tasksData, isLoading: tasksLoading } = useCachedPromise(
    async (accessToken: string, lid: string) => {
      if (!lid) return { items: [] };
      return api.getTasks(accessToken, lid, { maxResults: 100, showCompleted: false });
    },
    [token, listId],
    { execute: listId.length > 0 },
  );

  const parentCandidates = tasksData?.items?.filter((t) => t.id && !t.parent) ?? [];

  async function handleSubmit(values: {
    title: string;
    notes: string;
    due: Date | null;
    dueNatural: string;
    listId: string;
    parentId: string;
  }) {
    const title = values.title.trim();
    if (!title) {
      await showToast({ style: Toast.Style.Failure, title: "Title is required" });
      return;
    }
    const lid = values.listId || defaultListId;
    if (!lid) {
      await showToast({ style: Toast.Style.Failure, title: "No task list available" });
      return;
    }

    const dueNatural = values.dueNatural.trim();
    let dueIso: string | undefined;
    if (dueNatural) {
      const parsed = parseDueInput(dueNatural);
      if (!parsed) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Could not parse due date",
          message: "Try a phrase like “tomorrow” or a calendar date like 2026-05-15 (dates only; time is not saved).",
        });
        return;
      }
      dueIso = parsed;
    } else {
      dueIso = values.due ? dateToDueRFC3339(values.due) : undefined;
    }

    try {
      await api.createTask(token, lid, {
        title,
        notes: values.notes.trim() || undefined,
        due: dueIso,
        parent: values.parentId && values.parentId !== "__none__" ? values.parentId : undefined,
      });
      await rememberTaskListId(lid);
      await showToast({ style: Toast.Style.Success, title: "Task created" });
      pop();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not create task",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const listItems = lists.filter((l) => l.id);

  return (
    <Form
      navigationTitle="Create Task"
      isLoading={tasksLoading && listId.length > 0}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create" icon={Icon.Plus} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Title" placeholder="What needs doing?" />
      <Form.TextArea id="notes" title="Notes" enableMarkdown />
      <Form.Description
        title="Due date"
        text="Only the calendar day is stored: the public Google Tasks API ignores time on due. See https://developers.google.com/workspace/tasks/reference/rest/v1/tasks#Task.FIELDS.string.due"
      />
      <Form.TextField
        id="dueNatural"
        title="Due (natural language)"
        placeholder="Optional: overrides calendar — e.g. tomorrow, next Friday, EOD (date only)"
      />
      <Form.DatePicker id="due" title="Due (calendar)" type={Form.DatePicker.Type.Date} />
      <Form.Dropdown id="listId" title="List" defaultValue={defaultListId} onChange={setListId}>
        {listItems.map((l) => (
          <Form.Dropdown.Item key={l.id} value={l.id!} title={l.title ?? "Untitled"} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="parentId" title="Parent task" defaultValue="__none__">
        <Form.Dropdown.Item value="__none__" title="None" />
        {parentCandidates.map((t) => (
          <Form.Dropdown.Item key={t.id} value={t.id!} title={t.title ?? "(No title)"} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

function AuthenticatedCreateView() {
  const { token } = getAccessToken();
  const { data, isLoading } = useCachedPromise(
    async (accessToken: string) => api.getTaskLists(accessToken, { maxResults: 100 }),
    [token],
    { failureToastOptions: { title: "Could not load lists" } },
  );

  const lists = useMemo(() => data?.items ?? [], [data]);

  if (isLoading) {
    return <Form navigationTitle="Create Task" isLoading />;
  }

  if (lists.length === 0) {
    return (
      <Form navigationTitle="Create Task">
        <Form.Description title="" text="No task lists found. Create one in Google Tasks first." />
      </Form>
    );
  }

  return <CreateTaskForm lists={lists} />;
}

function CreateCommandWrapper() {
  return <AuthenticatedCreateView />;
}

export default function CreateTaskCommand() {
  const { googleClientId } = getPreferenceValues<Preferences>();
  const trimmed = (googleClientId ?? "").trim();
  const oauthService = useMemo(
    () => (trimmed.length > 0 ? createGoogleOAuthService(trimmed) : null),
    [trimmed],
  );
  const Authorized = useMemo(() => {
    if (!oauthService) return null;
    return withAccessToken(oauthService)(CreateCommandWrapper);
  }, [oauthService]);

  if (!Authorized) {
    return <SetupView />;
  }
  return <Authorized />;
}
