import { Effect } from "effect";
import {
  TaskSchema,
  TaskListsResponseSchema,
  TasksResponseSchema,
  type Task,
  type TaskListsResponse,
  type TasksResponse,
} from "./schema";
import { googleTasksRequestEffect, googleTasksVoidRequestEffect, type GoogleTasksError, type GoogleTasksClient } from "./client";

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
  params?: { maxResults?: number; pageToken?: string },
): Effect.Effect<TaskListsResponse, GoogleTasksError, GoogleTasksClient> {
  const search = new URLSearchParams();
  appendCommonListParams(search, {
    maxResults: params?.maxResults !== undefined ? String(params.maxResults) : undefined,
    pageToken: params?.pageToken,
  });
  const q = search.toString();
  return googleTasksRequestEffect(
    `/users/@me/lists${q ? `?${q}` : ""}`,
    {},
    TaskListsResponseSchema,
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
  taskListId: string,
  params?: ListTasksParams,
): Effect.Effect<TasksResponse, GoogleTasksError, GoogleTasksClient> {
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
  return googleTasksRequestEffect(
    `/lists/${encodeURIComponent(taskListId)}/tasks${q ? `?${q}` : ""}`,
    {},
    TasksResponseSchema,
  );
}

/**
 * Creates a task. **`parent` is sent as the insert query parameter** (`?parent=`); the Tasks API
 * marks `parent` on the Task resource as output-only, so it is ignored if placed in the JSON body.
 * @see https://developers.google.com/tasks/reference/rest/v1/tasks/insert
 */
export function createTaskEffect(
  taskListId: string,
  task: Partial<Task> & { title: string },
): Effect.Effect<Task, GoogleTasksError, GoogleTasksClient> {
  const { parent, ...body } = task;

  const search = new URLSearchParams();
  if (parent !== undefined && parent !== "") {
    search.set("parent", parent);
  }

  const q = search.toString();

  return googleTasksRequestEffect(
    `/lists/${encodeURIComponent(taskListId)}/tasks${q ? `?${q}` : ""}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    TaskSchema,
  );
}

export function patchTaskEffect(
  taskListId: string,
  taskId: string,
  patch: Partial<Task>,
): Effect.Effect<Task, GoogleTasksError, GoogleTasksClient> {
  return googleTasksRequestEffect(
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
    TaskSchema,
  );
}

export function replaceTaskEffect(
  taskListId: string,
  taskId: string,
  task: Task,
): Effect.Effect<Task, GoogleTasksError, GoogleTasksClient> {
  return googleTasksRequestEffect(
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PUT",
      body: JSON.stringify(task),
    },
    TaskSchema,
  );
}

export function deleteTaskEffect(
  taskListId: string,
  taskId: string,
): Effect.Effect<undefined, GoogleTasksError, GoogleTasksClient> {
  return googleTasksVoidRequestEffect(
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: "DELETE" },
  );
}

export function completeTaskEffect(
  taskListId: string,
  taskId: string,
): Effect.Effect<Task, GoogleTasksError, GoogleTasksClient> {
  return patchTaskEffect(taskListId, taskId, { status: "completed" });
}

export function moveTaskEffect(
  taskListId: string,
  taskId: string,
  options: { parent?: string; previous?: string },
): Effect.Effect<Task, GoogleTasksError, GoogleTasksClient> {
  const params = new URLSearchParams();
  if (options.parent) params.set("parent", options.parent);
  if (options.previous) params.set("previous", options.previous);
  const q = params.toString();
  return googleTasksRequestEffect(
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}/move${q ? `?${q}` : ""}`,
    { method: "POST" },
    TaskSchema,
  );
}

export function clearCompletedTasksEffect(
  taskListId: string,
): Effect.Effect<undefined, GoogleTasksError, GoogleTasksClient> {
  return googleTasksVoidRequestEffect(
    `/lists/${encodeURIComponent(taskListId)}/clear`,
    { method: "POST" },
  );
}

const MENU_BAR_TASK_FETCH_PAGES = 15;

/**
 * Pages through `tasks.list` until no `nextPageToken` or max pages (menu bar / broad filters).
 */
export function getTasksAllPagesEffect(
  taskListId: string,
  baseParams: Omit<ListTasksParams, "pageToken">,
): Effect.Effect<Task[], GoogleTasksError, GoogleTasksClient> {
  return Effect.gen(function* () {
    const items: Task[] = [];
    let pageToken: string | undefined;
    for (let i = 0; i < MENU_BAR_TASK_FETCH_PAGES; i++) {
      const res = yield* getTasksEffect(taskListId, {
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

export type { Task, TaskList, TaskListsResponse, TasksResponse } from "./schema";
