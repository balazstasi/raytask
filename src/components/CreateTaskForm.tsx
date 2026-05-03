import {
  Action,
  ActionPanel,
  Form,
  Icon,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { getAccessToken, useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import * as api from "../services/google-tasks/api";
import { dateToDueRFC3339, parseDueInput } from "../utils/date";
import { rememberTaskListId } from "../utils/storage";
import { runEffectPromise, runEffectWithToast } from "../utils/effect-bridge";
import type { Task, TaskList } from "../types";

export type CreateTaskFormProps = {
  lists: TaskList[];
  /** List where the task (or parent) lives — locked when adding a subtask. */
  initialListId?: string;
  lockedParent?: { id: string; title: string };
  onSaved?: () => void;
};

export function CreateTaskForm({ lists, initialListId, lockedParent, onSaved }: CreateTaskFormProps) {
  const { token } = getAccessToken();
  const { pop } = useNavigation();

  const listItems = useMemo(() => lists.filter((l) => l.id), [lists]);
  const defaultListFromProps =
    initialListId && listItems.some((l) => l.id === initialListId) ?
      initialListId
    : (listItems[0]?.id ?? "");
  const [listId, setListId] = useState(defaultListFromProps);

  const lockedListItems =
    lockedParent ? listItems.filter((l) => l.id === defaultListFromProps) : listItems;
  const listDropdownItems = lockedListItems.length > 0 ? lockedListItems : listItems;

  const { data: tasksData, isLoading: tasksLoading } = useCachedPromise(
    async (accessToken: string, lid: string) => {
      if (!lid || lockedParent) return { items: [] as Task[] };
      return runEffectPromise(api.getTasksEffect(accessToken, lid, { maxResults: 100, showCompleted: false }));
    },
    [token, listId],
    { execute: listId.length > 0 && !lockedParent },
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
    const lid = lockedParent ? defaultListFromProps : values.listId || defaultListFromProps;
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

    const parent =
      lockedParent?.id ??
      (values.parentId && values.parentId !== "__none__" ? values.parentId : undefined);

    const result = await runEffectWithToast(
      api.createTaskEffect(token, lid, {
        title,
        notes: values.notes.trim() || undefined,
        due: dueIso,
        parent,
      }),
      { successTitle: lockedParent ? "Subtask created" : "Task created", errorTitle: "Could not create task" },
    );
    if (result !== undefined) {
      await rememberTaskListId(lid);
      onSaved?.();
      pop();
    }
  }

  return (
    <Form
      navigationTitle={lockedParent ? "Add Subtask" : "Create Task"}
      isLoading={lockedParent ? false : tasksLoading && listId.length > 0}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={lockedParent ? "Add Subtask" : "Create"}
            icon={Icon.Plus}
            onSubmit={handleSubmit}
          />
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
      {lockedParent ? (
        <Form.Description
          title="Parent"
          text={`Subtask of “${lockedParent.title}”. Google Tasks only supports one level of subtasks; add them under a top-level task.`}
        />
      ) : null}
      <Form.Dropdown
        id="listId"
        title="List"
        defaultValue={defaultListFromProps}
        onChange={lockedParent ? undefined : setListId}
      >
        {listDropdownItems.map((l) => (
          <Form.Dropdown.Item key={l.id} value={l.id!} title={l.title ?? "Untitled"} />
        ))}
      </Form.Dropdown>
      {!lockedParent ? (
        <Form.Dropdown id="parentId" title="Parent task" defaultValue="__none__">
          <Form.Dropdown.Item value="__none__" title="None" />
          {parentCandidates.map((t) => (
            <Form.Dropdown.Item key={t.id} value={t.id!} title={t.title ?? "(No title)"} />
          ))}
        </Form.Dropdown>
      ) : null}
    </Form>
  );
}
