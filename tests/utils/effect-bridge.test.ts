import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { openExtensionPreferencesMock, showToastMock } from "../mocks/raycast";
import { GoogleTasksClient } from "../../src/services/google-tasks/client";
import {
  GoogleTasksHttpError,
  GoogleTasksNetworkError,
  GoogleTasksParseError,
} from "../../src/services/google-tasks/errors";
import {
  runEffectPromise,
  runEffectWithToast,
} from "../../src/utils/effect-bridge";

describe("effect bridge", () => {
  it("injects the Google Tasks client into effects", async () => {
    const effect = Effect.gen(function* () {
      const client = yield* GoogleTasksClient;
      return client.accessToken;
    });

    await expect(runEffectPromise("token-123", effect)).resolves.toBe("token-123");
  });

  it("shows a success toast when configured", async () => {
    await expect(
      runEffectWithToast("token-123", Effect.succeed("ok"), {
        successTitle: "Saved",
        errorTitle: "Failed",
      }),
    ).resolves.toBe("ok");

    expect(showToastMock).toHaveBeenCalledWith({
      style: "success",
      title: "Saved",
    });
  });

  it("shows an auth toast with a preferences action for 401/403 errors", async () => {
    await expect(
      runEffectWithToast(
        "token-123",
        Effect.fail(
          new GoogleTasksHttpError({
            status: 401,
            message: "Token expired",
          }),
        ),
        { errorTitle: "Failed" },
      ),
    ).rejects.toThrow("Token expired");

    const toast = showToastMock.mock.calls[0]?.[0] as {
      title: string;
      primaryAction?: { onAction: () => void };
    };

    expect(toast.title).toBe("Authentication failed");
    toast.primaryAction?.onAction();
    expect(openExtensionPreferencesMock).toHaveBeenCalledTimes(1);
  });

  it("shows specialized toasts for rate limits and network failures", async () => {
    await expect(
      runEffectWithToast(
        "token-123",
        Effect.fail(
          new GoogleTasksHttpError({
            status: 429,
            message: "Too many requests",
          }),
        ),
        { errorTitle: "Failed" },
      ),
    ).rejects.toThrow("Too many requests");

    expect(showToastMock.mock.calls[0]?.[0]).toMatchObject({
      title: "Rate limited",
      message: "Too many requests. Wait a moment and try again.",
    });

    showToastMock.mockClear();

    await expect(
      runEffectWithToast(
        "token-123",
        Effect.fail(
          new GoogleTasksNetworkError({
            message: "offline",
          }),
        ),
        { errorTitle: "Failed" },
      ),
    ).rejects.toThrow("offline");

    expect(showToastMock.mock.calls[0]?.[0]).toMatchObject({
      title: "Network error",
      message: "Check your internet connection and try again.",
    });
  });

  it("falls back to the provided error title for generic parse/http failures", async () => {
    await expect(
      runEffectWithToast(
        "token-123",
        Effect.fail(
          new GoogleTasksParseError({
            message: "Bad payload",
            rawText: "bad",
          }),
        ),
        { errorTitle: "Could not load tasks" },
      ),
    ).rejects.toThrow("Bad payload");

    expect(showToastMock.mock.calls[0]?.[0]).toMatchObject({
      title: "Could not load tasks",
      message: "Bad payload",
    });
  });
});
