import { truncateMiddle } from "./task-hierarchy";
import type { Task } from "./types";

const MAX_DETAIL_TITLE_CHARS = 80;

function isUtcMidnight(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

/**
 * Google Tasks `due` is date-only via the API (UTC midnight for the scheduled day is typical).
 * Format with `timeZone: "UTC"` so the calendar day does not shift across local time zones.
 */
export function formatTaskDueForDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (isUtcMidnight(d)) {
    return d.toLocaleDateString(undefined, {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatTaskSubtitle(task: Task): string | undefined {
  const parts: string[] = [];
  if (task.status === "completed") {
    parts.push("Completed");
  }
  if (task.due) {
    try {
      parts.push(formatTaskDueForDisplay(task.due));
    } catch {
      parts.push(task.due);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function formatTaskRowSubtitle(task: Task, parentDisplayTitle?: string): string | undefined {
  const base = formatTaskSubtitle(task);
  const under =
    parentDisplayTitle ?
      `Under: ${truncateMiddle(parentDisplayTitle, 40)}`
    : undefined;
  if (under && base) return `${under} · ${base}`;
  if (under) return under;
  return base;
}

function sortTasksByPosition(a: Task, b: Task): number {
  return (a.position ?? "").localeCompare(b.position ?? "");
}

export function buildTaskDetailMarkdown(task: Task, relationTasks?: Task[]): string {
  const lines: string[] = [`# ${task.title ?? "(No title)"}`, ""];
  const byId =
    relationTasks && relationTasks.length > 0 ?
      new Map(relationTasks.flatMap((t) => (t.id ? ([[t.id, t]] as const) : [])))
    : undefined;

  if (task.status === "completed") {
    lines.push("**Status:** Completed");
  } else {
    lines.push("**Status:** Open");
  }
  if (task.due) {
    let dueDisp: string;
    try {
      dueDisp = formatTaskDueForDisplay(task.due);
    } catch {
      dueDisp = task.due;
    }
    lines.push(`**Due:** ${dueDisp}`);
  }
  if (task.completed) {
    lines.push(`**Completed at:** ${task.completed}`);
  }
  if (task.webViewLink) {
    lines.push(`**Link:** ${task.webViewLink}`);
  }

  if (byId && task.parent) {
    const p = byId.get(task.parent);
    if (p?.title?.trim()) {
      lines.push(`**Parent:** ${truncateMiddle(p.title.trim(), MAX_DETAIL_TITLE_CHARS)}`);
    } else {
      lines.push("**Parent:** _Not visible in current filter — open Google Tasks or change filter to see link._");
    }
  }

  if (byId && task.id) {
    const children = relationTasks!.filter((t) => t.parent === task.id).sort(sortTasksByPosition);
    if (children.length > 0) {
      lines.push("");
      lines.push("## Subtasks");
      for (const c of children) {
        const mark = c.status === "completed" ? "~" : "";
        const tl = truncateMiddle((c.title ?? "(No title)").trim(), MAX_DETAIL_TITLE_CHARS);
        lines.push(`- ${mark}${tl}${mark}`);
      }
    }
  }

  lines.push("");
  lines.push("## Notes");
  lines.push(task.notes?.trim() ? task.notes : "_No notes_");
  return lines.join("\n");
}

export function matchesTaskSearch(task: Task, query: string, taskById?: Map<string, Task>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const title = (task.title ?? "").toLowerCase();
  const notes = (task.notes ?? "").toLowerCase();
  if (title.includes(q) || notes.includes(q)) return true;
  if (task.parent && taskById) {
    const parent = taskById.get(task.parent);
    const pt = (parent?.title ?? "").trim().toLowerCase();
    if (pt.includes(q)) return true;
  }
  return false;
}
