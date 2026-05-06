import { describe, expect, it, vi } from "vitest";
import { dateToDueRFC3339, parseDueInput } from "../../src/utils/date";

describe("date utilities", () => {
  it("encodes a local calendar day at UTC midnight", () => {
    const date = new Date("2026-05-06T17:45:00.000Z");

    expect(dateToDueRFC3339(date)).toBe("2026-05-06T00:00:00.000Z");
  });

  it("parses natural language dates including EOD aliases", () => {
    vi.setSystemTime(new Date("2026-05-06T09:00:00.000Z"));

    expect(parseDueInput("EOD")).toBe("2026-05-06T00:00:00.000Z");
    expect(parseDueInput("end of day")).toBe("2026-05-06T00:00:00.000Z");
  });

  it("parses ISO date input and rejects invalid text", () => {
    expect(parseDueInput("2026-05-15")).toBe("2026-05-15T00:00:00.000Z");
    expect(parseDueInput("not-a-date")).toBeUndefined();
    expect(parseDueInput(undefined)).toBeUndefined();
  });
});
