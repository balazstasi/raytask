import { describe, expect, it } from "vitest";
import {
  directChildCountsInSet,
  formatHierarchyListTitle,
  indexTasksById,
  orderTasksForList,
  resolvedParentDisplayTitle,
  truncateMiddle,
} from "../../src/domain/hierarchy";
import { makeTask } from "../fixtures/google-tasks";

describe("hierarchy helpers", () => {
  it("indexes tasks and counts direct children in scope", () => {
    const root = makeTask({ id: "root", title: "Root" });
    const child = makeTask({ id: "child", title: "Child", parent: "root" });
    const grandchild = makeTask({ id: "grandchild", title: "Grandchild", parent: "child" });

    const byId = indexTasksById([root, child, grandchild]);
    const counts = directChildCountsInSet([root, child, grandchild]);

    expect(byId.get("child")?.title).toBe("Child");
    expect(counts.get("root")).toBe(1);
    expect(counts.get("child")).toBe(1);
  });

  it("orders roots and descendants by position and keeps orphans visible", () => {
    const rootB = makeTask({ id: "root-b", title: "Root B", position: "b" });
    const rootA = makeTask({ id: "root-a", title: "Root A", position: "a" });
    const childA2 = makeTask({ id: "child-a2", title: "Child A2", parent: "root-a", position: "b" });
    const childA1 = makeTask({ id: "child-a1", title: "Child A1", parent: "root-a", position: "a" });
    const orphan = makeTask({ id: "orphan", title: "Orphan", parent: "missing", position: "c" });

    const ordered = orderTasksForList([rootB, childA2, rootA, orphan, childA1]);

    expect(ordered.map(({ task, depth }) => `${task.id}:${depth}`)).toEqual([
      "root-a:0",
      "child-a1:1",
      "child-a2:1",
      "root-b:0",
      "orphan:0",
    ]);
  });

  it("formats list titles and resolves visible parent titles", () => {
    const root = makeTask({ id: "root", title: "Parent title" });
    const child = makeTask({ id: "child", title: "Child", parent: "root" });
    const byId = indexTasksById([root, child]);
    const idsInScope = new Set(["root", "child"]);

    expect(formatHierarchyListTitle(2, "Nested")).toBe("    ↳ Nested");
    expect(truncateMiddle("abcdefghijklmnop", 7)).toBe("ab…op");
    expect(resolvedParentDisplayTitle(child, byId, idsInScope)).toBe("Parent title");
  });
});
