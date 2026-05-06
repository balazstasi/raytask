import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  createTaskEffect,
  getTaskListsEffect,
  getTasksAllPagesEffect,
  getTasksEffect,
} from "../../src/services/google-tasks/api";
import { BASE_URL } from "../../src/services/google-tasks/client";
import { makeTask, makeTaskList, makeTaskListsResponse, makeTasksResponse } from "../fixtures/google-tasks";
import { runGoogleEffect } from "../helpers/run-google-effect";
import { server } from "../msw/server";

describe("google tasks api helpers", () => {
  it("builds list and task query params correctly", async () => {
    const list = makeTaskList({ id: "list-1", title: "Inbox" });
    let listsUrl = "";
    let tasksUrl = "";

    server.use(
      http.get(`${BASE_URL}/users/@me/lists`, ({ request }) => {
        listsUrl = request.url;
        return HttpResponse.json(makeTaskListsResponse([list]));
      }),
      http.get(`${BASE_URL}/lists/:taskListId/tasks`, ({ request }) => {
        tasksUrl = request.url;
        return HttpResponse.json(makeTasksResponse([makeTask({ id: "task-1" })]));
      }),
    );

    await runGoogleEffect(getTaskListsEffect({ maxResults: 25, pageToken: "next-page" }));
    await runGoogleEffect(
      getTasksEffect("list with spaces", {
        maxResults: 50,
        showCompleted: false,
        showHidden: true,
        dueMin: "2026-05-01T00:00:00.000Z",
        assignmentStatus: "needsAction",
      }),
    );

    const parsedListsUrl = new URL(listsUrl);
    expect(parsedListsUrl.searchParams.get("maxResults")).toBe("25");
    expect(parsedListsUrl.searchParams.get("pageToken")).toBe("next-page");

    const parsedTasksUrl = new URL(tasksUrl);
    expect(parsedTasksUrl.pathname).toContain("/lists/list%20with%20spaces/tasks");
    expect(parsedTasksUrl.searchParams.get("maxResults")).toBe("50");
    expect(parsedTasksUrl.searchParams.get("showCompleted")).toBe("false");
    expect(parsedTasksUrl.searchParams.get("showHidden")).toBe("true");
    expect(parsedTasksUrl.searchParams.get("dueMin")).toBe("2026-05-01T00:00:00.000Z");
    expect(parsedTasksUrl.searchParams.get("assignmentStatus")).toBe("needsAction");
  });

  it("sends create parent as a query param instead of in the body", async () => {
    const task = makeTask({ id: "task-1", title: "Created" });
    let requestUrl = "";
    let requestBody = "";

    server.use(
      http.post(`${BASE_URL}/lists/list-1/tasks`, async ({ request }) => {
        requestUrl = request.url;
        requestBody = await request.text();
        return HttpResponse.json(task);
      }),
    );

    await runGoogleEffect(
      createTaskEffect("list-1", {
        title: "Created",
        notes: "Details",
        parent: "parent-1",
      }),
    );

    const parsedUrl = new URL(requestUrl);
    expect(parsedUrl.searchParams.get("parent")).toBe("parent-1");
    expect(requestBody).toBe(JSON.stringify({ title: "Created", notes: "Details" }));
  });

  it("paginates across all task pages", async () => {
    const firstPageTask = makeTask({ id: "task-1" });
    const secondPageTask = makeTask({ id: "task-2" });

    server.use(
      http.get(`${BASE_URL}/lists/list-1/tasks`, ({ request }) => {
        const pageToken = new URL(request.url).searchParams.get("pageToken");
        if (!pageToken) {
          return HttpResponse.json(makeTasksResponse([firstPageTask], "page-2"));
        }
        expect(pageToken).toBe("page-2");
        return HttpResponse.json(makeTasksResponse([secondPageTask]));
      }),
    );

    const tasks = await runGoogleEffect(
      getTasksAllPagesEffect("list-1", {
        maxResults: 100,
        showCompleted: true,
      }),
    );

    expect(tasks).toEqual([firstPageTask, secondPageTask]);
  });
});
