export interface TaskList {
  kind?: string;
  id?: string;
  etag?: string;
  title?: string;
  updated?: string;
  selfLink?: string;
}

export interface Task {
  kind?: string;
  id?: string;
  etag?: string;
  title?: string;
  /** Output only in API — useful for sorting undated tasks */
  updated?: string;
  notes?: string;
  status?: "needsAction" | "completed";
  due?: string;
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
  parent?: string;
  position?: string;
  links?: Record<string, { type?: string; description?: string; link?: string }>;
  webViewLink?: string;
  assignmentInfo?: Record<string, unknown>;
  selfLink?: string;
}

export interface TaskListsResponse {
  kind?: string;
  etag?: string;
  items?: TaskList[];
  nextPageToken?: string;
}

export interface TasksResponse {
  kind?: string;
  etag?: string;
  items?: Task[];
  nextPageToken?: string;
}

export interface GoogleTasksApiErrorBody {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ domain?: string; reason?: string; message?: string }>;
    status?: string;
    details?: unknown[];
  };
}
