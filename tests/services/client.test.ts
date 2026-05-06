import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  BASE_URL,
  googleTasksRequestEffect,
  googleTasksVoidRequestEffect,
} from "../../src/services/google-tasks/client";
import { TaskSchema, TaskListsResponseSchema } from "../../src/services/google-tasks/schema";
import { makeGoogleTasksErrorBody, makeTask } from "../fixtures/google-tasks";
import { runGoogleEffect } from "../helpers/run-google-effect";
import { server } from "../msw/server";

describe("google tasks client", () => {
  it("injects auth and content-type headers for JSON requests", async () => {
    const task = makeTask({ id: "created-task", title: "Created" });
    let authHeader = "";
    let contentType = "";
    let body = "";

    server.use(
      http.post(`${BASE_URL}/lists/list-1/tasks`, async ({ request }) => {
        authHeader = request.headers.get("authorization") ?? "";
        contentType = request.headers.get("content-type") ?? "";
        body = await request.text();
        return HttpResponse.json(task);
      }),
    );

    const result = await runGoogleEffect(
      googleTasksRequestEffect(
        "/lists/list-1/tasks",
        { method: "POST", body: JSON.stringify({ title: "Created" }) },
        TaskSchema,
      ),
      "oauth-token",
    );

    expect(result).toEqual(task);
    expect(authHeader).toBe("Bearer oauth-token");
    expect(contentType).toContain("application/json");
    expect(body).toBe(JSON.stringify({ title: "Created" }));
  });

  it("maps structured HTTP errors", async () => {
    server.use(
      http.get(`${BASE_URL}/users/@me/lists`, () =>
        HttpResponse.json(makeGoogleTasksErrorBody("Token expired", 401), {
          status: 401,
          statusText: "Unauthorized",
        })),
    );

    await expect(runGoogleEffect(googleTasksRequestEffect("/users/@me/lists", {}, TaskListsResponseSchema))).rejects.toThrow(
      "Token expired",
    );
  });

  it("maps network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await expect(runGoogleEffect(googleTasksRequestEffect("/users/@me/lists", {}, TaskListsResponseSchema))).rejects.toThrow(
      "offline",
    );
  });

  it("fails on invalid JSON payloads", async () => {
    server.use(
      http.get(`${BASE_URL}/users/@me/lists`, () =>
        new HttpResponse("not-json", {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })),
    );

    await expect(runGoogleEffect(googleTasksRequestEffect("/users/@me/lists", {}, TaskListsResponseSchema))).rejects.toThrow(
      "Invalid JSON from Google Tasks API",
    );
  });

  it("accepts empty responses for void requests", async () => {
    server.use(
      http.delete(`${BASE_URL}/lists/list-1/tasks/task-1`, () => new HttpResponse(null, { status: 204 })),
    );

    await expect(runGoogleEffect(googleTasksVoidRequestEffect("/lists/list-1/tasks/task-1", { method: "DELETE" }))).resolves.toBeUndefined();
  });

  it("rejects unexpected bodies for void requests", async () => {
    server.use(
      http.post(`${BASE_URL}/lists/list-1/clear`, () => new HttpResponse("unexpected", { status: 200 })),
    );

    await expect(runGoogleEffect(googleTasksVoidRequestEffect("/lists/list-1/clear", { method: "POST" }))).rejects.toThrow(
      "Expected empty response body",
    );
  });
});
