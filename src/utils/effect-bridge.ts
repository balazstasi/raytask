import { Effect } from "effect";
import { Toast, openExtensionPreferences, showToast } from "@raycast/api";
import { GoogleTasksClient } from "../services/google-tasks/client";
import type { GoogleTasksError } from "../services/google-tasks/errors";

function showContextualToastEffect(
  error: GoogleTasksError,
  fallbackTitle: string,
): Effect.Effect<void> {
  switch (error._tag) {
    case "GoogleTasksHttpError": {
      if (error.status === 401 || error.status === 403) {
        return Effect.promise(() =>
          showToast({
            style: Toast.Style.Failure,
            title: "Authentication failed",
            message: "Sign out and reconnect in extension preferences.",
            primaryAction: {
              title: "Open Preferences",
              onAction: () => openExtensionPreferences(),
            },
          }),
        );
      }
      if (error.status === 429) {
        return Effect.promise(() =>
          showToast({
            style: Toast.Style.Failure,
            title: "Rate limited",
            message: "Too many requests. Wait a moment and try again.",
          }),
        );
      }
      return Effect.promise(() =>
        showToast({
          style: Toast.Style.Failure,
          title: fallbackTitle,
          message: error.message,
        }),
      );
    }
    case "GoogleTasksNetworkError": {
      return Effect.promise(() =>
        showToast({
          style: Toast.Style.Failure,
          title: "Network error",
          message: "Check your internet connection and try again.",
        }),
      );
    }
    case "GoogleTasksParseError": {
      return Effect.promise(() =>
        showToast({
          style: Toast.Style.Failure,
          title: fallbackTitle,
          message: error.message,
        }),
      );
    }
  }
}

/**
 * Run an Effect that requires a `GoogleTasksClient` and return its result as a Promise.
 * The OAuth `token` is injected into the Effect context automatically.
 * Useful inside `useCachedPromise` and other React hooks that expect Promises.
 */
export async function runEffectPromise<T, E>(
  token: string,
  effect: Effect.Effect<T, E, GoogleTasksClient>,
): Promise<T> {
  return Effect.runPromise(
    Effect.provideService(effect, GoogleTasksClient, { accessToken: token }),
  );
}

/**
 * Run an Effect that requires a `GoogleTasksClient`, show a success toast on completion,
 * and show a contextual error toast for known Google Tasks failures (auth, rate-limit, network).
 * The OAuth `token` is injected into the Effect context automatically.
 * Errors are propagated after the toast is shown; callers should wrap in
 * try/catch if they need to handle the failure case.
 */
export async function runEffectWithToast<T>(
  token: string,
  effect: Effect.Effect<T, GoogleTasksError, GoogleTasksClient>,
  options: { successTitle?: string; errorTitle: string },
): Promise<T> {
  return Effect.runPromise(
    Effect.provideService(
      effect.pipe(
        Effect.tap(() => {
          const title = options.successTitle;
          if (!title) return Effect.void;
          return Effect.promise(() =>
            showToast({ style: Toast.Style.Success, title }),
          );
        }),
        Effect.tapError((error) => showContextualToastEffect(error, options.errorTitle)),
      ),
      GoogleTasksClient,
      { accessToken: token },
    ),
  );
}
