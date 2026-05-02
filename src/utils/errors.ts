import { Toast, openExtensionPreferences, showToast } from "@raycast/api";
import { GoogleTasksHttpError, GoogleTasksNetworkError } from "../services/google-tasks/client";

/**
 * Displays a user-friendly toast for any API or network error.
 * Handles auth failures (401/403), rate limits (429), and network errors
 * with actionable messages instead of raw exception text.
 */
export async function showErrorToast(error: unknown, fallbackTitle: string): Promise<void> {
  const fallbackMessage = error instanceof Error ? error.message : String(error);

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
      return;
    }
    if (error.status === 429) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Rate limited",
        message: "Too many requests. Wait a moment and try again.",
      });
      return;
    }
    await showToast({
      style: Toast.Style.Failure,
      title: fallbackTitle,
      message: error.message || fallbackMessage,
    });
    return;
  }

  if (error instanceof GoogleTasksNetworkError) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Network error",
      message: "Check your internet connection and try again.",
    });
    return;
  }

  await showToast({
    style: Toast.Style.Failure,
    title: fallbackTitle,
    message: fallbackMessage,
  });
}
