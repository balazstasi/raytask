import { Context, Effect, Schema } from "effect";
import {
  GoogleTasksApiErrorBodySchema,
  type GoogleTasksApiErrorBody,
} from "./schema";
import {
  GoogleTasksHttpError,
  GoogleTasksNetworkError,
  GoogleTasksParseError,
} from "./errors";

/** Re-export tagged errors and the union for consumers. */
export { GoogleTasksHttpError, GoogleTasksNetworkError, GoogleTasksParseError };
export type { GoogleTasksError } from "./errors";

export const BASE_URL = "https://tasks.googleapis.com/tasks/v1";

/** Service tag that carries the OAuth access token for Google Tasks API calls. */
export class GoogleTasksClient extends Context.Tag("GoogleTasksClient")<
  GoogleTasksClient,
  { readonly accessToken: string }
>() {}

/** ------------------------------------------------------------------ */
/** Effect-based request pipeline                                        */
/** ------------------------------------------------------------------ */

function parseResponseEffect<T>(
  res: Response,
  schema: Schema.Schema<T, any, never>,
): Effect.Effect<T, GoogleTasksParseError> {
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
    const parsed = yield* Effect.try({
      try: () => JSON.parse(text),
      catch: () => new GoogleTasksParseError({ message: "Invalid JSON from Google Tasks API", rawText: text }),
    });
    const decoded = yield* Schema.decodeUnknown(schema)(parsed).pipe(
      Effect.mapError(
        (e) =>
          new GoogleTasksParseError({
            message: `Response did not match expected schema: ${String(e)}`,
            rawText: text,
          }),
      ),
    );
    return decoded;
  });
}

export function googleTasksRequestEffect<T>(
  path: string,
  init: RequestInit = {},
  schema: Schema.Schema<T, any, never>,
): Effect.Effect<T, GoogleTasksHttpError | GoogleTasksNetworkError | GoogleTasksParseError, GoogleTasksClient> {
  return Effect.gen(function* () {
    const client = yield* GoogleTasksClient;
    const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
    const hasBody = init.body !== undefined && init.body !== null;
    const headers = new Headers(init.headers ?? undefined);
    headers.set("Authorization", `Bearer ${client.accessToken}`);
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

      const bodyPayload = text ?
        yield* Schema.decodeUnknown(GoogleTasksApiErrorBodySchema)(JSON.parse(text)).pipe(
          Effect.orElseSucceed(() => undefined),
        ) :
        undefined;

      if (bodyPayload?.error?.message) {
        message = bodyPayload.error.message;
      }

      yield* Effect.fail(
        new GoogleTasksHttpError({
          status: res.status,
          message,
          body: bodyPayload,
        }),
      );
    }

    return yield* parseResponseEffect<T>(res, schema);
  });
}
