import type React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { openExtensionPreferencesMock } from "../mocks/raycast";

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(
    (Component: React.ComponentType, Fallback?: React.ComponentType) =>
      Component ?? Fallback,
  ),
}));

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("../../src/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div>ErrorBoundary: {children}</div>
  ),
}));

vi.mock("../../src/views/TaskListsView", () => ({
  TaskListsView: () => <div>TaskListsView</div>,
}));

vi.mock("../../src/views/EditTaskPicker", () => ({
  EditTaskPicker: () => <div>EditTaskPicker</div>,
}));

vi.mock("../../src/views/MenuBarView", () => ({
  MenuBarView: () => <div>MenuBarView</div>,
}));

import IndexCommand from "../../src/commands/index";
import EditTaskCommand from "../../src/commands/edit-task";
import MenuBarCommand from "../../src/commands/menu-bar";

describe("command wrappers", () => {
  it("renders the authenticated index and edit command trees", () => {
    render(<IndexCommand />);
    render(<EditTaskCommand />);

    expect(screen.getByText("TaskListsView")).toBeInTheDocument();
    expect(screen.getByText("EditTaskPicker")).toBeInTheDocument();
  });

  it("renders the menu bar fallback when auth returns the fallback component", () => {
    useAuthMock.mockImplementationOnce(
      (_Component: React.ComponentType, Fallback?: React.ComponentType) =>
        Fallback ?? _Component,
    );

    render(<MenuBarCommand />);

    fireEvent.click(screen.getByRole("button", { name: "Set OAuth Client ID…" }));
    expect(openExtensionPreferencesMock).toHaveBeenCalledTimes(1);
  });

  it("renders the authenticated menu bar wrapper", () => {
    render(<MenuBarCommand />);

    expect(screen.getByText("MenuBarView")).toBeInTheDocument();
  });
});
