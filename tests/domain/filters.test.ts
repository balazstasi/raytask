import { describe, expect, it, vi } from "vitest";
import { getTasksParamsForFilter, isTaskFilter, taskFilterLabel } from "../../src/domain/filters";

describe("task filters", () => {
  it("recognizes supported filter values", () => {
    expect(isTaskFilter("today")).toBe(true);
    expect(isTaskFilter("later")).toBe(false);
  });

  it("maps filter labels", () => {
    expect(taskFilterLabel("all")).toBe("All");
    expect(taskFilterLabel("completed")).toBe("Completed");
  });

  it("builds API params for all filters", () => {
    vi.setSystemTime(new Date("2026-05-06T09:00:00.000Z"));

    expect(getTasksParamsForFilter("all")).toEqual({
      maxResults: 100,
      showCompleted: true,
      showHidden: true,
    });

    expect(getTasksParamsForFilter("completed")).toEqual({
      maxResults: 100,
      showCompleted: true,
      showHidden: true,
    });

    expect(getTasksParamsForFilter("today")).toEqual({
      maxResults: 100,
      showCompleted: true,
      showHidden: true,
      dueMin: "2026-05-06T00:00:00.000Z",
      dueMax: "2026-05-06T23:59:59.999Z",
    });

    expect(getTasksParamsForFilter("upcoming")).toEqual({
      maxResults: 100,
      showCompleted: false,
      showHidden: true,
      dueMin: "2026-05-07T00:00:00.000Z",
    });
  });
});
