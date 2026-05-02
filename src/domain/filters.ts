import type { ListTasksParams } from "../services/google-tasks/api";

export type TaskFilter = "all" | "today" | "upcoming" | "completed";

export function taskFilterLabel(f: TaskFilter): string {
  switch (f) {
    case "all":
      return "All";
    case "today":
      return "Today";
    case "upcoming":
      return "Upcoming";
    case "completed":
      return "Completed";
    default:
      return f;
  }
}

function localDayBoundsUtcIso(day: Date): { dueMin: string; dueMax: string } {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return { dueMin: start.toISOString(), dueMax: end.toISOString() };
}

/** Start of "tomorrow" in local calendar (exclusive end of today for upcoming). */
function localTomorrowStartIso(): string {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return t.toISOString();
}

export function getTasksParamsForFilter(filter: TaskFilter): ListTasksParams {
  /** Required alongside showCompleted so completed tasks still appear in API results (incl. first-party "hidden" semantics). */
  const base: ListTasksParams = { maxResults: 100, showHidden: true };

  switch (filter) {
    case "all":
      return { ...base, showCompleted: true };
    case "completed":
      return { ...base, showCompleted: true };
    case "today": {
      const { dueMin, dueMax } = localDayBoundsUtcIso(new Date());
      return { ...base, showCompleted: true, dueMin, dueMax };
    }
    case "upcoming":
      return {
        ...base,
        showCompleted: false,
        dueMin: localTomorrowStartIso(),
      };
    default:
      return { ...base, showCompleted: true };
  }
}
