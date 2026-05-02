import type { GoogleTasksApiErrorBody, Task, TaskListsResponse, TasksResponse } from "./types";

export const BASE_URL = "https://tasks.googleapis.com/tasks/v1";

export class GoogleTasksHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: GoogleTasksApiErrorBody,
  ) {
    super(message);
    this.name = "GoogleTasksHttpError";
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function googleTasksRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const hasBody = init.body !== undefined && init.body !== null;
  const headers = new Headers(init.headers ?? undefined);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, {
    ...init,
    headers,
  });

  let bodyPayload: GoogleTasksApiErrorBody | undefined;
  if (!res.ok) {
    const text = await res.text();
    let message =
      res.status === 401
        ? "Google rejected the token. Try signing out of RayTask and connecting again."
        : res.statusText || `Request failed (${res.status})`;
    try {
      if (text) {
        bodyPayload = JSON.parse(text) as GoogleTasksApiErrorBody;
        if (bodyPayload.error?.message) {
          message = bodyPayload.error.message;
        }
      }
    } catch {
      /* use default message */
    }
    throw new GoogleTasksHttpError(res.status, message, bodyPayload);
  }

  return parseResponse<T>(res);
}

function appendCommonListParams(search: URLSearchParams, opts: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(opts)) {
    if (v !== undefined && v !== "") {
      search.set(k, v);
    }
  }
}

export async function getTaskLists(
  accessToken: string,
  params?: { maxResults?: number; pageToken?: string },
): Promise<TaskListsResponse> {
  const search = new URLSearchParams();
  appendCommonListParams(search, {
    maxResults: params?.maxResults !== undefined ? String(params.maxResults) : undefined,
    pageToken: params?.pageToken,
  });
  const q = search.toString();
  return googleTasksRequest<TaskListsResponse>(
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

export async function getTasks(
  accessToken: string,
  taskListId: string,
  params?: ListTasksParams,
): Promise<TasksResponse> {
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
  return googleTasksRequest<TasksResponse>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks${q ? `?${q}` : ""}`,
  );
}

export async function createTask(
  accessToken: string,
  taskListId: string,
  task: Partial<Task> & { title: string },
): Promise<Task> {
  return googleTasksRequest<Task>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks`,
    {
      method: "POST",
      body: JSON.stringify(task),
    },
  );
}

export async function patchTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  patch: Partial<Task>,
): Promise<Task> {
  return googleTasksRequest<Task>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
}

export async function replaceTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  task: Task,
): Promise<Task> {
  return googleTasksRequest<Task>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PUT",
      body: JSON.stringify(task),
    },
  );
}

export async function deleteTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
): Promise<void> {
  await googleTasksRequest<void>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: "DELETE" },
  );
}

export async function completeTask(accessToken: string, taskListId: string, taskId: string): Promise<Task> {
  return patchTask(accessToken, taskListId, taskId, { status: "completed" });
}

export async function moveTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  options: { parent?: string; previous?: string },
): Promise<Task> {
  const params = new URLSearchParams();
  if (options.parent) params.set("parent", options.parent);
  if (options.previous) params.set("previous", options.previous);
  const q = params.toString();
  return googleTasksRequest<Task>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}/move${q ? `?${q}` : ""}`,
    { method: "POST" },
  );
}

export async function clearCompletedTasks(accessToken: string, taskListId: string): Promise<void> {
  await googleTasksRequest<void>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/clear`,
    { method: "POST" },
  );
}

const MENU_BAR_TASK_FETCH_PAGES = 15;

/**
 * Pages through `tasks.list` until no `nextPageToken` or max pages (menu bar / broad filters).
 */
export async function getTasksAllPages(
  accessToken: string,
  taskListId: string,
  baseParams: Omit<ListTasksParams, "pageToken">,
): Promise<Task[]> {
  const items: Task[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < MENU_BAR_TASK_FETCH_PAGES; i++) {
    const res = await getTasks(accessToken, taskListId, {
      ...baseParams,
      pageToken,
    });
    items.push(...(res.items ?? []));
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
  return items;
}
