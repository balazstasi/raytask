import type { Task } from "./types";

export function formatTaskSubtitle(task: Task): string | undefined {
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

export function buildTaskDetailMarkdown(task: Task): string {
  const lines: string[] = [`# ${task.title ?? "(No title)"}`, ""];
  if (task.status === "completed") {
    lines.push("**Status:** Completed");
  } else {
    lines.push("**Status:** Open");
  }
  if (task.due) {
    lines.push(`**Due:** ${task.due}`);
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
