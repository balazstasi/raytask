import { Effect } from "effect";
import { Toast, openExtensionPreferences, showToast } from "@raycast/api";
import {
  GoogleTasksHttpError,
  GoogleTasksNetworkError,
  type GoogleTasksError,
} from "../services/google-tasks/errors";

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
 * Returns the result on success, or `undefined` on failure (after showing toast).
 */
export async function runEffectWithToast<T>(
  effect: Effect.Effect<T, GoogleTasksError>,
  options: { successTitle?: string; errorTitle: string },
): Promise<T | undefined> {
  try {
    const result = await Effect.runPromise(effect);
    if (options.successTitle) {
      await showToast({ style: Toast.Style.Success, title: options.successTitle });
    }
    return result;
  } catch (error) {
    if (error instanceof GoogleTasksHttpError) {
      if (error.status === 401 || error.status === 403) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Authentication failed",
          message: "Sign out and reconnect in extension preferences.",
          primaryAction: {
            title: "Open Preferences",
            onAction: () => openExtensionPreferences(),
          },
        });
        return undefined;
      }
      if (error.status === 429) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Rate limited",
          message: "Too many requests. Wait a moment and try again.",
        });
        return undefined;
      }
      await showToast({
        style: Toast.Style.Failure,
        title: options.errorTitle,
        message: error.message,
      });
      return undefined;
    }

    if (error instanceof GoogleTasksNetworkError) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Network error",
        message: "Check your internet connection and try again.",
      });
      return undefined;
    }

    await showToast({
      style: Toast.Style.Failure,
      title: options.errorTitle,
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
