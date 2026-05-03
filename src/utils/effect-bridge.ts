import { Effect } from "effect";
import { Toast, openExtensionPreferences, showToast } from "@raycast/api";
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
 * Run an Effect and return its result as a Promise.
 * Useful inside `useCachedPromise` and other React hooks that expect Promises.
 */
export async function runEffectPromise<T, E>(effect: Effect.Effect<T, E>): Promise<T> {
  return Effect.runPromise(effect);
}

/**
 * Run an Effect, show a success toast on completion, and show a contextual
 * error toast for known Google Tasks failures (auth, rate-limit, network).
 * Errors are propagated after the toast is shown; callers should wrap in
 * try/catch if they need to handle the failure case.
 */
export async function runEffectWithToast<T>(
  effect: Effect.Effect<T, GoogleTasksError>,
  options: { successTitle?: string; errorTitle: string },
): Promise<T> {
  return Effect.runPromise(
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
  );
}
