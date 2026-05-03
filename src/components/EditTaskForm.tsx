import { Action, ActionPanel, Form, Icon, Toast, showToast, useNavigation } from "@raycast/api";
import { getAccessToken } from "@raycast/utils";
import { useMemo } from "react";
import * as api from "../services/google-tasks/api";
import { moveTaskToAnotherListEffect } from "../domain/move";
import { indexTasksById } from "../domain/hierarchy";
import { dateToDueRFC3339, parseDueInput } from "../utils/date";
import { runEffectWithToast } from "../utils/effect-bridge";
import type { Task, TaskList } from "../types";

export type EditTaskFormProps = {
  taskListId: string;
  task: Task;
  lists: TaskList[];
  /** Tasks in the same list (e.g. current filter scope) to resolve parent titles. */
  relationshipContext?: Task[];
  onSaved?: () => void;
};

function dueIsoToLocalDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function calendarDayKey(d: Date | null): number | null {
  if (!d) return null;
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

export function EditTaskForm({ taskListId, task, lists, relationshipContext, onSaved }: EditTaskFormProps) {
  const { token } = getAccessToken();
  const { pop } = useNavigation();
  const initialDue = useMemo(() => dueIsoToLocalDate(task.due), [task.due]);

  const parentTaskLabel = useMemo(() => {
    if (!task.parent) return null;
    const byId = relationshipContext?.length ? indexTasksById(relationshipContext) : null;
    const t = byId?.get(task.parent)?.title?.trim();
    if (t) return t;
    return "Not in the current list or filter — open Google Tasks.";
  }, [task.parent, relationshipContext]);

  async function handleSubmit(values: {
    title: string;
    notes: string;
    due: Date | null;
    dueNatural: string;
    status: string;
    listId: string;
  }) {
    const title = values.title.trim();
    if (!title) {
      await showToast({ style: Toast.Style.Failure, title: "Title is required" });
      return;
    }

    const dueNatural = values.dueNatural.trim();
    let resolvedDueDate: Date | null = values.due;
    if (dueNatural) {
      const parsedIso = parseDueInput(dueNatural);
      if (!parsedIso) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Could not parse due date",
          message: "Try a phrase like “tomorrow” or a calendar date like 2026-05-15 (dates only; time is not saved).",
        });
        return;
      }
      resolvedDueDate = dueIsoToLocalDate(parsedIso);
    }

    const dueDayChanged = calendarDayKey(resolvedDueDate) !== calendarDayKey(initialDue);
    const newDueIso = resolvedDueDate ? dateToDueRFC3339(resolvedDueDate) : undefined;

    let effect;
    if (values.listId !== taskListId && task.id) {
      const updated: Task = {
        ...task,
        title,
        notes: values.notes.trim() || undefined,
        due: dueDayChanged ? newDueIso : task.due,
        status: values.status === "completed" ? "completed" : "needsAction",
      };
      effect = moveTaskToAnotherListEffect(token, taskListId, values.listId, updated);
    } else {
      if (!task.id) {
        await showToast({ style: Toast.Style.Failure, title: "Task has no id" });
        return;
      }
      const patch: Partial<Task> = {
        title,
        notes: values.notes.trim() || undefined,
        status: values.status === "completed" ? "completed" : "needsAction",
      };
      if (dueDayChanged) {
        patch.due = newDueIso ?? undefined;
      }
      effect = api.patchTaskEffect(token, taskListId, task.id, patch);
    }

    try {
      await runEffectWithToast(effect, { successTitle: "Task updated", errorTitle: "Could not save task" });
      onSaved?.();
      pop();
    } catch {
      /* error already toasted */
    }
  }

  const listItems = lists.filter((l) => l.id);

  return (
    <Form
      navigationTitle="Edit Task"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      {parentTaskLabel ? <Form.Description title="Parent task" text={parentTaskLabel} /> : null}
      <Form.TextField id="title" title="Title" defaultValue={task.title ?? ""} />
      <Form.TextArea id="notes" title="Notes" defaultValue={task.notes ?? ""} />
      <Form.Description
        title="Due date"
        text="Only the calendar day is stored: the public Google Tasks API ignores time on due. See https://developers.google.com/workspace/tasks/reference/rest/v1/tasks#Task.FIELDS.string.due"
      />
      <Form.TextField
        id="dueNatural"
        title="Due (natural language)"
        placeholder="Optional: overrides calendar — e.g. tomorrow, next Friday, EOD (date only)"
      />
      <Form.DatePicker id="due" title="Due (calendar)" type={Form.DatePicker.Type.Date} defaultValue={initialDue} />
      <Form.Dropdown id="status" title="Status" defaultValue={task.status === "completed" ? "completed" : "needsAction"}>
        <Form.Dropdown.Item value="needsAction" title="Open" />
        <Form.Dropdown.Item value="completed" title="Completed" />
      </Form.Dropdown>
      <Form.Dropdown id="listId" title="List" defaultValue={taskListId}>
        {listItems.map((l) => (
          <Form.Dropdown.Item key={l.id} value={l.id!} title={l.title ?? "Untitled"} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
