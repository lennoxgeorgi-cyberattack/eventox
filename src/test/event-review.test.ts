import { describe, expect, it } from "vitest";
import { isExpiredOneTimeEvent, reviewEvent } from "@/lib/event-review";
import { normalizeImport } from "@/lib/event-import";

const today = "2026-10-21";
const event = { title: "Dorffest Fritzlar", description: "Umzug", place: "Fritzlar", date: "2026-10-25", lat: 51.13, lng: 9.28 };

describe("event review", () => {
  it("rejects nonsense, spam, places outside Germany and duplicates", () => {
    expect(reviewEvent({ ...event, title: "asdf" }, [], today).ok).toBe(false);
    expect(reviewEvent({ ...event, title: "mmmmmmmmm" }, [], today).ok).toBe(false);
    expect(reviewEvent({ ...event, lat: 10, lng: 10 }, [], today).ok).toBe(false);
    expect(reviewEvent(event, [event], today).ok).toBe(false);
    expect(reviewEvent(event, [], today).ok).toBe(true);
  });

  it("hides one-time events after their date and keeps repeating ones", () => {
    expect(isExpiredOneTimeEvent({ date: "2026-10-20" }, today)).toBe(true);
    expect(isExpiredOneTimeEvent({ date: "2026-10-21" }, today)).toBe(false);
    expect(isExpiredOneTimeEvent({ date: "2020-01-01", repeat: "weekly" }, today)).toBe(false);
  });

  it("keeps an external id so an import can be checked against its source", () => {
    const result = normalizeImport("kalender", { externalId: "k-1" });
    expect(result.ok && result.draft.externalId).toBe("k-1");
    expect(normalizeImport("", { externalId: "k-1" }).ok).toBe(false);
  });
});
