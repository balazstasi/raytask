import { describe, expect, it } from "vitest";
import {
  dueCalendarDatePrefix,
  looksLikeDailyRepeatTask,
  menuBarRowSubtitle,
  sortTasksForMenuBarToday,
  taskMatchesMenuBarTodayAgenda,
} from "../../src/domain/menu-bar-filter";
import { makeTask } from "../fixtures/google-tasks";

describe("menu bar filtering", () => {
  it("extracts the calendar date prefix from Google due timestamps", () => {
    expect(dueCalendarDatePrefix("2026-05-06T00:00:00.000Z")).toBe("2026-05-06");
    expect(dueCalendarDatePrefix("")).toBeNull();
  });

  it("detects daily repeat heuristics from title and notes", () => {
    expect(looksLikeDailyRepeatTask(makeTask({ title: "[daily] Water plants" }))).toBe(true);
    expect(looksLikeDailyRepeatTask(makeTask({ notes: "Repeat: daily" }))).toBe(true);
    expect(looksLikeDailyRepeatTask(makeTask({ title: "One-off" }))).toBe(false);
  });

  it("matches due, overdue, and undated daily tasks for today's agenda", () => {
    expect(taskMatchesMenuBarTodayAgenda(makeTask({ due: "2026-05-06T00:00:00.000Z" }), "2026-05-06")).toBe(true);
    expect(taskMatchesMenuBarTodayAgenda(makeTask({ due: "2026-05-05T00:00:00.000Z" }), "2026-05-06")).toBe(true);
    expect(taskMatchesMenuBarTodayAgenda(makeTask({ due: "2026-05-07T00:00:00.000Z" }), "2026-05-06")).toBe(false);
    expect(taskMatchesMenuBarTodayAgenda(makeTask({ title: "[daily] Stretch" }), "2026-05-06")).toBe(true);
    expect(taskMatchesMenuBarTodayAgenda(makeTask({ status: "completed" }), "2026-05-06")).toBe(false);
    expect(taskMatchesMenuBarTodayAgenda(makeTask({ deleted: true, due: "2026-05-06T00:00:00.000Z" }), "2026-05-06")).toBe(false);
  });

  it("sorts open overdue work before today, undated, and completed items", () => {
    const overdue = makeTask({ id: "overdue", due: "2026-05-05T00:00:00.000Z", position: "2" });
    const today = makeTask({ id: "today", due: "2026-05-06T00:00:00.000Z", position: "1" });
    const undated = makeTask({ id: "undated", position: "3" });
    const completed = makeTask({ id: "completed", status: "completed", due: "2026-05-05T00:00:00.000Z", position: "4" });

    const ordered = [completed, undated, today, overdue].sort((a, b) => sortTasksForMenuBarToday(a, b, "2026-05-06"));

    expect(ordered.map((task) => task.id)).toEqual(["overdue", "today", "undated", "completed"]);
  });

  it("builds row subtitles for menu bar items", () => {
    expect(menuBarRowSubtitle(makeTask({ status: "completed" }), "2026-05-06")).toBe("Tap to mark open");
    expect(menuBarRowSubtitle(makeTask({ due: "2026-05-05T00:00:00.000Z" }), "2026-05-06", "Parent Task")).toBe(
      "Under: Parent Task · Overdue",
    );
    expect(menuBarRowSubtitle(makeTask({ title: "[daily] Read" }), "2026-05-06")).toBe("Daily habit (no due date)");
  });
});
