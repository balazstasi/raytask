import { Data } from "effect";
import type { GoogleTasksApiErrorBody } from "../../types";

/**
 * HTTP error from the Google Tasks API (non-2xx status code).
 * Carries status, message, and optionally the parsed error body.
 */
export class GoogleTasksHttpError extends Data.TaggedError("GoogleTasksHttpError")<{
  readonly status: number;
  readonly message: string;
  readonly body?: GoogleTasksApiErrorBody;
}> {}

/**
 * Network-level failure (fetch threw, no response received).
 */
export class GoogleTasksNetworkError extends Data.TaggedError("GoogleTasksNetworkError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Response body could not be parsed as JSON.
 */
export class GoogleTasksParseError extends Data.TaggedError("GoogleTasksParseError")<{
  readonly message: string;
  readonly rawText: string;
}> {}

/** Union of all recoverable Google Tasks service errors. */
export type GoogleTasksError =
  | GoogleTasksHttpError
  | GoogleTasksNetworkError
  | GoogleTasksParseError;
