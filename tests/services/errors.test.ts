import { describe, expect, it } from "vitest";
import {
  GoogleTasksHttpError,
  GoogleTasksNetworkError,
  GoogleTasksParseError,
} from "../../src/services/google-tasks/errors";

describe("google tasks errors", () => {
  it("preserves tagged error data", () => {
    const httpError = new GoogleTasksHttpError({
      status: 400,
      message: "Bad request",
    });
    const networkError = new GoogleTasksNetworkError({
      message: "offline",
    });
    const parseError = new GoogleTasksParseError({
      message: "Invalid JSON",
      rawText: "oops",
    });

    expect(httpError._tag).toBe("GoogleTasksHttpError");
    expect(httpError.status).toBe(400);
    expect(networkError._tag).toBe("GoogleTasksNetworkError");
    expect(parseError.rawText).toBe("oops");
  });
});
