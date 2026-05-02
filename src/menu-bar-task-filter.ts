import type { Task } from "./types";

/**
 * Google Tasks stores `due` as RFC3339 but only the calendar date matters.
 * Compare using the literal YYYY-MM-DD prefix to avoid TZ drift vs API filters.
 */
export function dueCalendarDatePrefix(due?: string): string | null {
  if (!due?.trim()) return null;
  const m = due.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

/** Local calendar date YYYY-MM-DD (user's timezone). */
export function todayLocalCalendarDate(): string {
  const n = new Date();
  const y = n.getFullYear();
  const mo = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/**
 * Heuristic: Google Tasks REST does not expose RRULE/recurrence. Some repeating
 * habits appear as open tasks without `due` or with hints in text.
 */
export function looksLikeDailyRepeatTask(task: Task): boolean {
  const blob = `${task.title ?? ""}\n${task.notes ?? ""}`.toLowerCase();
  return (
    /\b(every day|each day|daily habit|repeat\s*:\s*daily|recurrence\s*:\s*daily|repeats\s+daily)\b/.test(blob) ||
    /\[daily\]|\(daily\)/i.test(task.title ?? "")
  );
}

/**
 * Menu bar agenda for “today”:
 * - Tasks with a due date on or before today (today + overdue), open or completed.
 * - Open tasks with no due date that look like daily repeats (API cannot expose real recurrence).
 */
export function taskMatchesMenuBarTodayAgenda(task: Task, today: string = todayLocalCalendarDate()): boolean {
  if (task.deleted) return false;

  const duePrefix = dueCalendarDatePrefix(task.due);
  if (duePrefix) {
    return duePrefix <= today;
  }

  if (task.status === "completed") {
    return false;
  }

  return looksLikeDailyRepeatTask(task);
}

function urgencyTier(task: Task, today: string): number {
  const dp = dueCalendarDatePrefix(task.due);
  if (!dp) return 6;
  if (dp < today) return 2;
  if (dp === today) return 4;
  return 8;
}

/** Sort: open first (overdue → due today → undated), then completed; tie-break due date then API position. */
export function sortTasksForMenuBarToday(a: Task, b: Task, today: string = todayLocalCalendarDate()): number {
  const ac = a.status === "completed" ? 1 : 0;
  const bc = b.status === "completed" ? 1 : 0;
  if (ac !== bc) return ac - bc;

  const ta = urgencyTier(a, today);
  const tb = urgencyTier(b, today);
  if (ta !== tb) return ta - tb;

  const da = dueCalendarDatePrefix(a.due);
  const db = dueCalendarDatePrefix(b.due);
  if (da && db && da !== db) return da.localeCompare(db);

  return (a.position ?? "").localeCompare(b.position ?? "");
}

/** @param parentTitle — trimmed parent task title when showing a subtask in the menu bar */
export function menuBarRowSubtitle(
  task: Task,
  today: string = todayLocalCalendarDate(),
  parentTitle?: string,
): string {
  let base: string;
  if (task.status === "completed") {
    base = "Tap to mark open";
  } else {
    const dp = dueCalendarDatePrefix(task.due);
    if (!dp) {
      base = looksLikeDailyRepeatTask(task) ? "Daily habit (no due date)" : "No due date";
    } else if (dp < today) {
      base = "Overdue";
    } else {
      base = "Due today";
    }
  }
  const trimmedParent = parentTitle?.trim();
  if (!trimmedParent) return base;
  const short =
    trimmedParent.length > 32 ? `${trimmedParent.slice(0, 29).trimEnd()}…` : trimmedParent;
  return `Under: ${short} · ${base}`;
}
