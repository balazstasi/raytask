import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { resetGoogleTasksFixtureCounters } from "./fixtures/google-tasks";
import { resetRaycastApiMocks } from "./mocks/raycast";
import { resetRaycastUtilsMocks } from "./mocks/raycast-utils";
import { server } from "./msw/server";

process.env.TZ = "UTC";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetGoogleTasksFixtureCounters();
  resetRaycastApiMocks();
  resetRaycastUtilsMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

afterAll(() => {
  server.close();
});
