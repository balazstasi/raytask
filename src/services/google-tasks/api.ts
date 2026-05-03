import { Effect } from "effect";
import type { Task, TaskListsResponse, TasksResponse } from "../../types";
import { googleTasksRequest, googleTasksRequestEffect, type GoogleTasksError } from "./client";

function appendCommonListParams(search: URLSearchParams, opts: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(opts)) {
    if (v !== undefined && v !== "") {
      search.set(k, v);
    }
  }
}

/** ------------------------------------------------------------------ */
/** Effect-based API functions                                          */
/** ------------------------------------------------------------------ */

export function getTaskListsEffect(
  accessToken: string,
  params?: { maxResults?: number; pageToken?: string },
): Effect.Effect<TaskListsResponse, GoogleTasksError> {
  const search = new URLSearchParams();
  appendCommonListParams(search, {
    maxResults: params?.maxResults !== undefined ? String(params.maxResults) : undefined,
    pageToken: params?.pageToken,
  });
  const q = search.toString();
  return googleTasksRequestEffect<TaskListsResponse>(
    accessToken,
    `/users/@me/lists${q ? `?${q}` : ""}`,
  );
}

export type ListTasksParams = {
  maxResults?: number;
  pageToken?: string;
  completedMin?: string;
  completedMax?: string;
  dueMin?: string;
  dueMax?: string;
  updatedMin?: string;
  showCompleted?: boolean;
  showDeleted?: boolean;
  showHidden?: boolean;
  showAssigned?: boolean;
  assignmentStatus?: string;
};

export function getTasksEffect(
  accessToken: string,
  taskListId: string,
  params?: ListTasksParams,
): Effect.Effect<TasksResponse, GoogleTasksError> {
  const search = new URLSearchParams();
  const { showCompleted, showDeleted, showHidden, showAssigned, ...rest } = params ?? {};
  appendCommonListParams(search, {
    maxResults: rest.maxResults !== undefined ? String(rest.maxResults) : undefined,
    pageToken: rest.pageToken,
    completedMin: rest.completedMin,
    completedMax: rest.completedMax,
    dueMin: rest.dueMin,
    dueMax: rest.dueMax,
    updatedMin: rest.updatedMin,
    assignmentStatus: rest.assignmentStatus,
  });
  if (showCompleted !== undefined) {
    search.set("showCompleted", String(showCompleted));
  }
  if (showDeleted !== undefined) {
    search.set("showDeleted", String(showDeleted));
  }
  if (showHidden !== undefined) {
    search.set("showHidden", String(showHidden));
  }
  if (showAssigned !== undefined) {
    search.set("showAssigned", String(showAssigned));
  }
  const q = search.toString();
  return googleTasksRequestEffect<TasksResponse>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks${q ? `?${q}` : ""}`,
  );
}

/**
 * Creates a task. **`parent` is sent as the insert query parameter** (`?parent=`); the Tasks API
 * marks `parent` on the Task resource as output-only, so it is ignored if placed in the JSON body.
 * @see https://developers.google.com/tasks/reference/rest/v1/tasks/insert
 */
export function createTaskEffect(
  accessToken: string,
  taskListId: string,
  task: Partial<Task> & { title: string },
): Effect.Effect<Task, GoogleTasksError> {
  const { parent, ...body } = task;

  const search = new URLSearchParams();
  if (parent !== undefined && parent !== "") {
    search.set("parent", parent);
  }

  const q = search.toString();

  return googleTasksRequestEffect<Task>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks${q ? `?${q}` : ""}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function patchTaskEffect(
  accessToken: string,
  taskListId: string,
  taskId: string,
  patch: Partial<Task>,
): Effect.Effect<Task, GoogleTasksError> {
  return googleTasksRequestEffect<Task>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
}

export function replaceTaskEffect(
  accessToken: string,
  taskListId: string,
  taskId: string,
  task: Task,
): Effect.Effect<Task, GoogleTasksError> {
  return googleTasksRequestEffect<Task>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PUT",
      body: JSON.stringify(task),
    },
  );
}

export function deleteTaskEffect(
  accessToken: string,
  taskListId: string,
  taskId: string,
): Effect.Effect<void, GoogleTasksError> {
  return googleTasksRequestEffect<void>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: "DELETE" },
  );
}

export function completeTaskEffect(
  accessToken: string,
  taskListId: string,
  taskId: string,
): Effect.Effect<Task, GoogleTasksError> {
  return patchTaskEffect(accessToken, taskListId, taskId, { status: "completed" });
}

export function moveTaskEffect(
  accessToken: string,
  taskListId: string,
  taskId: string,
  options: { parent?: string; previous?: string },
): Effect.Effect<Task, GoogleTasksError> {
  const params = new URLSearchParams();
  if (options.parent) params.set("parent", options.parent);
  if (options.previous) params.set("previous", options.previous);
  const q = params.toString();
  return googleTasksRequestEffect<Task>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}/move${q ? `?${q}` : ""}`,
    { method: "POST" },
  );
}

export function clearCompletedTasksEffect(
  accessToken: string,
  taskListId: string,
): Effect.Effect<void, GoogleTasksError> {
  return googleTasksRequestEffect<void>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/clear`,
    { method: "POST" },
  );
}

const MENU_BAR_TASK_FETCH_PAGES = 15;

/**
 * Pages through `tasks.list` until no `nextPageToken` or max pages (menu bar / broad filters).
 */
export function getTasksAllPagesEffect(
  accessToken: string,
  taskListId: string,
  baseParams: Omit<ListTasksParams, "pageToken">,
): Effect.Effect<Task[], GoogleTasksError> {
  return Effect.gen(function* () {
    const items: Task[] = [];
    let pageToken: string | undefined;
    for (let i = 0; i < MENU_BAR_TASK_FETCH_PAGES; i++) {
      const res = yield* getTasksEffect(accessToken, taskListId, {
        ...baseParams,
        pageToken,
      });
      items.push(...(res.items ?? []));
      if (!res.nextPageToken) break;
      pageToken = res.nextPageToken;
    }
    return items;
  });
}

/** ------------------------------------------------------------------ */
/** Backward-compatible Promise wrappers (to be removed in later step)  */
/** ------------------------------------------------------------------ */

export async function getTaskLists(
  accessToken: string,
  params?: { maxResults?: number; pageToken?: string },
): Promise<TaskListsResponse> {
  return Effect.runPromise(getTaskListsEffect(accessToken, params));
}

export async function getTasks(
  accessToken: string,
  taskListId: string,
  params?: ListTasksParams,
): Promise<TasksResponse> {
  return Effect.runPromise(getTasksEffect(accessToken, taskListId, params));
}

export async function createTask(
  accessToken: string,
  taskListId: string,
  task: Partial<Task> & { title: string },
): Promise<Task> {
  return Effect.runPromise(createTaskEffect(accessToken, taskListId, task));
}

export async function patchTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  patch: Partial<Task>,
): Promise<Task> {
  return Effect.runPromise(patchTaskEffect(accessToken, taskListId, taskId, patch));
}

export async function replaceTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  task: Task,
): Promise<Task> {
  return Effect.runPromise(replaceTaskEffect(accessToken, taskListId, taskId, task));
}

export async function deleteTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
): Promise<void> {
  return Effect.runPromise(deleteTaskEffect(accessToken, taskListId, taskId));
}

export async function completeTask(accessToken: string, taskListId: string, taskId: string): Promise<Task> {
  return Effect.runPromise(completeTaskEffect(accessToken, taskListId, taskId));
}

export async function moveTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  options: { parent?: string; previous?: string },
): Promise<Task> {
  return Effect.runPromise(moveTaskEffect(accessToken, taskListId, taskId, options));
}

export async function clearCompletedTasks(accessToken: string, taskListId: string): Promise<void> {
  return Effect.runPromise(clearCompletedTasksEffect(accessToken, taskListId));
}

export async function getTasksAllPages(
  accessToken: string,
  taskListId: string,
  baseParams: Omit<ListTasksParams, "pageToken">,
): Promise<Task[]> {
  return Effect.runPromise(getTasksAllPagesEffect(accessToken, taskListId, baseParams));
}
