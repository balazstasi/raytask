import type { Task } from "./types";

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

export function buildTaskDetailMarkdown(task: Task): string {
  const lines: string[] = [`# ${task.title ?? "(No title)"}`, ""];
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
  lines.push("");
  lines.push("## Notes");
  lines.push(task.notes?.trim() ? task.notes : "_No notes_");
  return lines.join("\n");
}

export function matchesTaskSearch(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const title = (task.title ?? "").toLowerCase();
  const notes = (task.notes ?? "").toLowerCase();
  return title.includes(q) || notes.includes(q);
}
