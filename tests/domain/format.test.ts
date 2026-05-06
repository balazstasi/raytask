import { describe, expect, it } from "vitest";
import {
  buildTaskDetailMarkdown,
  formatTaskRowSubtitle,
  formatTaskSubtitle,
  matchesTaskSearch,
} from "../../src/domain/format";
import { makeTask } from "../fixtures/google-tasks";

describe("format helpers", () => {
  it("formats subtitles from task status, due date, and parent title", () => {
    const task = makeTask({
      status: "completed",
      due: "2026-05-06T00:00:00.000Z",
    });

    expect(formatTaskSubtitle(task)).toContain("Completed");
    expect(formatTaskRowSubtitle(task, "Parent Task")).toContain("Under: Parent Task");
  });

  it("builds detail markdown with parent and child sections", () => {
    const parent = makeTask({ id: "parent", title: "Parent" });
    const task = makeTask({
      id: "task",
      title: "My Task",
      notes: "Important note",
      due: "2026-05-06T00:00:00.000Z",
      parent: "parent",
      webViewLink: "https://tasks.google.com",
    });
    const child = makeTask({ id: "child", title: "Child Task", parent: "task" });

    const markdown = buildTaskDetailMarkdown(task, [parent, task, child]);

    expect(markdown).toContain("# My Task");
    expect(markdown).toContain("**Parent:** Parent");
    expect(markdown).toContain("## Subtasks");
    expect(markdown).toContain("Child Task");
    expect(markdown).toContain("Important note");
  });

  it("matches search text against title, notes, and parent titles", () => {
    const parent = makeTask({ id: "parent", title: "Inbox" });
    const task = makeTask({ title: "Buy milk", notes: "Semi-skimmed", parent: "parent" });
    const byId = new Map([[parent.id, parent]]);

    expect(matchesTaskSearch(task, "milk", byId)).toBe(true);
    expect(matchesTaskSearch(task, "semi", byId)).toBe(true);
    expect(matchesTaskSearch(task, "inbox", byId)).toBe(true);
    expect(matchesTaskSearch(task, "bread", byId)).toBe(false);
  });
});
