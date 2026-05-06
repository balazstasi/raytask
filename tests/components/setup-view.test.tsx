import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetupView } from "../../src/components/SetupView";
import { openExtensionPreferencesMock } from "../mocks/raycast";

describe("SetupView", () => {
  it("shows setup guidance and opens extension preferences", () => {
    render(<SetupView />);

    expect(screen.getByText(/Connect Google Tasks/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Extension Preferences" }));

    expect(openExtensionPreferencesMock).toHaveBeenCalledTimes(1);
  });
});
