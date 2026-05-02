import type { Task } from "./types";

export function indexTasksById(tasks: Task[]): Map<string, Task> {
  const map = new Map<string, Task>();
  for (const t of tasks) {
    if (t.id) map.set(t.id, t);
  }
  return map;
}

function sortTasksByPosition(a: Task, b: Task): number {
  return (a.position ?? "").localeCompare(b.position ?? "");
}

/** Count of direct children of each task id that appear in `tasks`. */
export function directChildCountsInSet(tasks: Task[]): Map<string, number> {
  const ids = new Set(tasks.flatMap((t) => (t.id ? [t.id] : [])));
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const p = t.parent;
    if (!p || !ids.has(p)) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return counts;
}

function buildChildrenMap(tasks: Task[], ids: Set<string>): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const p = t.parent;
    if (!p || !ids.has(p)) continue;
    const list = map.get(p);
    if (list) list.push(t);
    else map.set(p, [t]);
  }
  for (const list of map.values()) {
    list.sort(sortTasksByPosition);
  }
  return map;
}

function isRootInSet(task: Task, ids: Set<string>): boolean {
  const p = task.parent;
  return !p || !ids.has(p);
}

/** Depth-first order; roots are tasks with missing parent or parent not in `tasks`. Siblings sorted by `position`. */
export function orderTasksForList(tasks: Task[]): { task: Task; depth: number }[] {
  const byId = indexTasksById(tasks);
  const ids = new Set(byId.keys());
  const childrenByParent = buildChildrenMap(tasks, ids);

  const roots = tasks.filter((t) => isRootInSet(t, ids));
  roots.sort(sortTasksByPosition);

  const ordered: { task: Task; depth: number }[] = [];
  const visited = new Set<string>();

  function visit(task: Task, depth: number) {
    if (!task.id) {
      ordered.push({ task, depth });
      return;
    }
    if (visited.has(task.id)) return;
    visited.add(task.id);
    ordered.push({ task, depth });

    const children = childrenByParent.get(task.id) ?? [];
    for (const c of children) {
      visit(c, depth + 1);
    }
  }

  for (const r of roots) {
    visit(r, 0);
  }

  for (const t of tasks) {
    if (t.id && !visited.has(t.id)) {
      ordered.push({ task: t, depth: 0 });
    }
  }

  return ordered;
}

export function truncateMiddle(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  if (maxLen <= 3) return s.slice(0, maxLen);
  const edge = Math.floor((maxLen - 3) / 2);
  return `${s.slice(0, edge)}…${s.slice(s.length - edge)}`;
}

export function formatHierarchyListTitle(depth: number, rawTitle: string): string {
  const title = rawTitle || "(No title)";
  if (depth <= 0) return title;
  const indent = "  ".repeat(depth);
  return `${indent}↳ ${title}`;
}

export function resolvedParentDisplayTitle(task: Task, byId: Map<string, Task>, parentIdsInScope: Set<string>): string | undefined {
  const pid = task.parent;
  if (!pid || !parentIdsInScope.has(pid)) return undefined;
  const raw = byId.get(pid)?.title?.trim();
  return raw || undefined;
}
