import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorBoundary } from "../../src/components/ErrorBoundary";

function Boom() {
  throw new Error("Kaboom");
}

describe("ErrorBoundary", () => {
  it("renders a friendly fallback when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.getByText(/Kaboom/)).toBeInTheDocument();
  });
});
