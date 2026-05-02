import * as chrono from "chrono-node";

/**
 * Google Tasks REST only records the calendar day on `due`; the time portion is discarded on write.
 * This module always encodes that day (chrono’s time-of-day is ignored on purpose).
 */

/** chrono misses bare "end of day" / "eod"; map to phrasing it understands. */
function normalizeNaturalDueInput(text: string): string {
  const t = text.trim();
  if (/^eod$/i.test(t)) {
    return "end of today";
  }
  return t.replace(/\bend\s+of\s+day\b/gi, "end of today");
}

/** Google Tasks due: local calendar day encoded as UTC midnight RFC3339. */
export function dateToDueRFC3339(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0)).toISOString();
}

/**
 * Parse a due string from natural language (chrono) or fall back to Date parsing (e.g. ISO dates).
 */
export function parseDueInput(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;

  const normalized = normalizeNaturalDueInput(trimmed);

  const fromChrono = chrono.casual.parseDate(normalized, new Date(), { forwardDate: true });
  if (fromChrono && !Number.isNaN(fromChrono.getTime())) {
    return dateToDueRFC3339(fromChrono);
  }

  const fromNative = new Date(normalized);
  if (!Number.isNaN(fromNative.getTime())) {
    return dateToDueRFC3339(fromNative);
  }

  return undefined;
}
