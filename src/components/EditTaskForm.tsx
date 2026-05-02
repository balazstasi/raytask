import { Action, ActionPanel, Form, Icon, Toast, showToast, useNavigation } from "@raycast/api";
import { getAccessToken } from "@raycast/utils";
import { useMemo } from "react";
import * as api from "../api";
import { moveTaskToAnotherList } from "../move-task";
import { dateToDueRFC3339, parseDueInput } from "../parse-due-input";
import type { Task, TaskList } from "../types";

export type EditTaskFormProps = {
  taskListId: string;
  task: Task;
  lists: TaskList[];
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

export function EditTaskForm({ taskListId, task, lists, onSaved }: EditTaskFormProps) {
  const { token } = getAccessToken();
  const { pop } = useNavigation();
  const initialDue = useMemo(() => dueIsoToLocalDate(task.due), [task.due]);

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
          message: "Try a phrase like “tomorrow” or a date like 2026-05-15.",
        });
        return;
      }
      resolvedDueDate = dueIsoToLocalDate(parsedIso);
    }

    try {
      const dueDayChanged = calendarDayKey(resolvedDueDate) !== calendarDayKey(initialDue);
      const newDueIso = resolvedDueDate ? dateToDueRFC3339(resolvedDueDate) : undefined;

      if (values.listId !== taskListId && task.id) {
        const updated: Task = {
          ...task,
          title,
          notes: values.notes.trim() || undefined,
          due: dueDayChanged ? newDueIso : task.due,
          status: values.status === "completed" ? "completed" : "needsAction",
        };
        await moveTaskToAnotherList(token, taskListId, values.listId, updated);
      } else {
        if (!task.id) {
          throw new Error("Task has no id");
        }
        const patch: Record<string, unknown> = {
          title,
          notes: values.notes.trim() || undefined,
          status: values.status === "completed" ? "completed" : "needsAction",
        };
        if (dueDayChanged) {
          patch.due = newDueIso ?? null;
        }
        await api.patchTask(token, taskListId, task.id, patch as Partial<Task>);
      }

      await showToast({ style: Toast.Style.Success, title: "Task updated" });
      onSaved?.();
      pop();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not save task",
        message: e instanceof Error ? e.message : String(e),
      });
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
      <Form.TextField id="title" title="Title" defaultValue={task.title ?? ""} />
      <Form.TextArea id="notes" title="Notes" defaultValue={task.notes ?? ""} />
      <Form.TextField
        id="dueNatural"
        title="Due (natural language)"
        placeholder="Optional: overrides calendar — tomorrow, next Friday, end of day…"
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
