import type { GoogleTasksApiErrorBody, Task, TaskList, TaskListsResponse, TasksResponse } from "../../src/services/google-tasks/schema";

let taskCounter = 0;
let listCounter = 0;

export function makeTask(overrides: Partial<Task> = {}): Task {
  taskCounter += 1;
  return {
    id: overrides.id ?? `task-${taskCounter}`,
    title: overrides.title ?? `Task ${taskCounter}`,
    status: overrides.status ?? "needsAction",
    ...overrides,
  };
}

export function makeTaskList(overrides: Partial<TaskList> = {}): TaskList {
  listCounter += 1;
  return {
    id: overrides.id ?? `list-${listCounter}`,
    title: overrides.title ?? `List ${listCounter}`,
    ...overrides,
  };
}

export function makeTasksResponse(items: Task[], nextPageToken?: string): TasksResponse {
  return nextPageToken ? { items, nextPageToken } : { items };
}

export function makeTaskListsResponse(items: TaskList[], nextPageToken?: string): TaskListsResponse {
  return nextPageToken ? { items, nextPageToken } : { items };
}

export function makeGoogleTasksErrorBody(message = "Something went wrong", code = 400): GoogleTasksApiErrorBody {
  return {
    error: {
      code,
      message,
      status: "INVALID_ARGUMENT",
    },
  };
}

export function resetGoogleTasksFixtureCounters(): void {
  taskCounter = 0;
  listCounter = 0;
}
