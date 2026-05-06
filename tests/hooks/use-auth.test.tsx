import React from "react";
import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAuth } from "../../src/hooks/useAuth";
import { setPreferenceValues } from "../mocks/raycast";
import { withAccessTokenMock } from "../mocks/raycast-utils";

describe("useAuth", () => {
  it("returns the fallback component when no Google client ID is configured", () => {
    setPreferenceValues({ googleClientId: "" });

    const Protected = () => <div>Protected</div>;
    const Fallback = () => <div>Fallback</div>;
    const { result } = renderHook(() => useAuth(Protected, Fallback));

    const Returned = result.current;
    render(<Returned />);

    expect(screen.getByText("Fallback")).toBeInTheDocument();
    expect(withAccessTokenMock).not.toHaveBeenCalled();
  });

  it("wraps the protected component when OAuth is configured", () => {
    setPreferenceValues({ googleClientId: "client-id.apps.googleusercontent.com" });

    const Protected = () => <div>Protected</div>;
    const Fallback = () => <div>Fallback</div>;
    const { result } = renderHook(() => useAuth(Protected, Fallback));

    const Returned = result.current;
    render(<Returned />);

    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(withAccessTokenMock).toHaveBeenCalledTimes(1);
  });
});
