import { Effect } from "effect";
import type { GoogleTasksApiErrorBody } from "../../types";
import {
  GoogleTasksHttpError,
  GoogleTasksNetworkError,
  GoogleTasksParseError,
} from "./errors";

/** Re-export tagged errors and the union for consumers. */
export { GoogleTasksHttpError, GoogleTasksNetworkError, GoogleTasksParseError };
export type { GoogleTasksError } from "./errors";

export const BASE_URL = "https://tasks.googleapis.com/tasks/v1";

/** ------------------------------------------------------------------ */
/** Effect-based request pipeline                                        */
/** ------------------------------------------------------------------ */

function parseResponseEffect<T>(res: Response): Effect.Effect<T, GoogleTasksParseError> {
  return Effect.gen(function* () {
    if (res.status === 204) {
      return undefined as T;
    }
    const text = yield* Effect.tryPromise({
      try: () => res.text(),
      catch: (e) =>
        new GoogleTasksParseError({
          message: e instanceof Error ? e.message : "Failed to read response body",
          rawText: "",
        }),
    });
    if (!text.trim()) {
      return undefined as T;
    }
    return yield* Effect.try({
      try: () => JSON.parse(text) as T,
      catch: () => new GoogleTasksParseError({ message: "Invalid JSON from Google Tasks API", rawText: text }),
    });
  });
}

export function googleTasksRequestEffect<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Effect.Effect<T, GoogleTasksHttpError | GoogleTasksNetworkError | GoogleTasksParseError> {
  return Effect.gen(function* () {
    const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
    const hasBody = init.body !== undefined && init.body !== null;
    const headers = new Headers(init.headers ?? undefined);
    headers.set("Authorization", `Bearer ${accessToken}`);
    if (hasBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          ...init,
          headers,
        }),
      catch: (e) => {
        const message = e instanceof Error ? e.message : "Network error. Check your connection.";
        return new GoogleTasksNetworkError({ message, cause: e });
      },
    });

    if (!res.ok) {
      const text = yield* Effect.tryPromise({
        try: () => res.text(),
        catch: (e) => {
          const fallback = res.status === 401
            ? "Google rejected the token. Try signing out of RayTask and connecting again."
            : res.statusText || `Request failed (${res.status})`;
          return new GoogleTasksHttpError({
            status: res.status,
            message: fallback,
          });
        },
      });

      let message =
        res.status === 401
          ? "Google rejected the token. Try signing out of RayTask and connecting again."
          : res.statusText || `Request failed (${res.status})`;
      let bodyPayload: GoogleTasksApiErrorBody | undefined;

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

      yield* Effect.fail(
        new GoogleTasksHttpError({
          status: res.status,
          message,
          body: bodyPayload,
        }),
      );
    }

    return yield* parseResponseEffect<T>(res);
  });
}

/** ------------------------------------------------------------------ */
/** Backward-compatible Promise wrapper (to be removed in later step)   */
/** ------------------------------------------------------------------ */

export async function googleTasksRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return Effect.runPromise(googleTasksRequestEffect<T>(accessToken, path, init));
}
