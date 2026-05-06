import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/commands/create-task", () => ({
  default: () => <div>CreateTaskEntry</div>,
}));

vi.mock("../src/commands/edit-task", () => ({
  default: () => <div>EditTaskEntry</div>,
}));

vi.mock("../src/commands/index", () => ({
  default: () => <div>IndexEntry</div>,
}));

vi.mock("../src/commands/menu-bar", () => ({
  default: () => <div>MenuBarEntry</div>,
}));

import CreateTaskEntry from "../src/create-task.tsx";
import EditTaskEntry from "../src/edit-task.tsx";
import IndexEntry from "../src/index.tsx";
import MenuBarEntry from "../src/menu-bar.tsx";

describe("root entrypoints", () => {
  it("re-export their command defaults", () => {
    render(
      <>
        <CreateTaskEntry />
        <EditTaskEntry />
        <IndexEntry />
        <MenuBarEntry />
      </>,
    );

    expect(screen.getByText("CreateTaskEntry")).toBeInTheDocument();
    expect(screen.getByText("EditTaskEntry")).toBeInTheDocument();
    expect(screen.getByText("IndexEntry")).toBeInTheDocument();
    expect(screen.getByText("MenuBarEntry")).toBeInTheDocument();
  });
});
