import { describe, expect, it } from "vitest";
import { missingPublishFields, parseEventInput, publishBlockerMessage } from "@/lib/event-input";

const base = {
  title: "Probekonzert",
  place: "Frankenberg",
  description: "Live",
  date: "2026-10-20",
  category: "Musik",
  lat: 51.05,
  lng: 8.8,
};

describe("event input", () => {
  it("requires a start time unless the event is all-day", () => {
    expect(parseEventInput({ ...base }).ok).toBe(false);
    const allDay = parseEventInput({ ...base, allDay: true, time: "19:00" });
    expect(allDay.ok && allDay.event).toMatchObject({ allDay: true });
    expect(allDay.ok && allDay.event.time).toBeUndefined();
    const timed = parseEventInput({ ...base, time: "19:00", endTime: "21:30", own: true });
    expect(timed.ok && timed.event).toMatchObject({ time: "19:00", endTime: "21:30" });
    expect(timed.ok && "own" in timed.event).toBe(false);
  });

  it("keeps description and image optional", () => {
    const result = parseEventInput({ title: "Probe", place: "Fritzlar", date: "2026-10-20", category: "Kirche", time: "10:00", lat: 51.13, lng: 9.28 });
    expect(result.ok && result.event).toMatchObject({ title: "Probe", place: "Fritzlar", category: "Kirche", time: "10:00", description: "" });
    expect(result.ok && result.event.image).toBeUndefined();
  });

  it("folds old festival categories into Fest", () => {
    const result = parseEventInput({ ...base, allDay: true, category: "Weinfest" });
    expect(result.ok && result.event.category).toBe("Fest");
  });

  it("names every field still missing before publish", () => {
    const missing = missingPublishFields({
      title: "  ",
      place: "",
      date: "2026-02-31",
      category: "Zauber",
      allDay: false,
      time: "",
      lat: Number.NaN,
      lng: 9.2,
    });
    expect(missing).toEqual(["Titel", "Ort", "Datum", "Kategorie", "Beginn (oder Ganztägig)", "Ort auf der Karte"]);
    expect(publishBlockerMessage(missing)).toBe(
      "Zum Veröffentlichen fehlt noch: Titel, Ort, Datum, Kategorie, Beginn (oder Ganztägig) und Ort auf der Karte.",
    );
    expect(missingPublishFields({ title: "Probe", place: "Fritzlar", date: "2026-10-20", category: "Fest", allDay: true, time: "", lat: 51.1, lng: 9.2 })).toEqual([]);
    expect(publishBlockerMessage([])).toBe("");
  });

  it("rejects an unknown category and a broken date", () => {
    expect(parseEventInput({ ...base, allDay: true, category: "Zauber" }).ok).toBe(false);
    expect(parseEventInput({ ...base, allDay: true, date: "2026-02-31" }).ok).toBe(false);
    const yearly = parseEventInput({ ...base, allDay: true, repeat: "yearly" });
    expect(yearly.ok && yearly.event.repeat).toBe("yearly");
  });
});
