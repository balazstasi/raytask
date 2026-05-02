import type { GoogleTasksApiErrorBody } from "../../types";

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

export class GoogleTasksNetworkError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GoogleTasksNetworkError";
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
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GoogleTasksHttpError(res.status, "Invalid response from Google Tasks API");
  }
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

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error. Check your connection.";
    throw new GoogleTasksNetworkError(message, e);
  }

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
