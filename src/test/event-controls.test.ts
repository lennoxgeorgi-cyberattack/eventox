import { describe, expect, it } from "vitest";
import { addHoursToIso, datePresetRange, eventOccursInRange, eventOccursOn, eventToIcs, formatEventTimeLabel, icsEscape, icsFilename, icsLocalStamp, icsUtcStamp, isAllDayEvent, navigationIndex, nextIsoDate, nextOccurrence, pinnedFriendsFirst, repeatDescription } from "@/lib/event-controls";
import { isAllGermany, RADIUS_MAX_KM } from "@/lib/events";

describe("Eventox controls", () => {
  const now = new Date(2026, 9, 14, 15);
  it("uses the current day for Heute", () => {
    expect(datePresetRange("today", now)).toEqual({ from: "2026-10-14", to: "2026-10-14" });
  });
  it("uses the next day for Morgen", () => {
    expect(datePresetRange("tomorrow", now)).toEqual({ from: "2026-10-15", to: "2026-10-15" });
  });
  it("includes days through Sunday for Diese Woche", () => {
    expect(datePresetRange("week", now)).toEqual({ from: "2026-10-14", to: "2026-10-18" });
  });
  it("puts pinned best friends first without mutating the list", () => {
    const friends = [{ id: "a", name: "Lena", favorites: [] }, { id: "b", name: "Jonas", favorites: [], pinned: true }];
    expect(pinnedFriendsFirst(friends).map((f) => f.id)).toEqual(["b", "a"]);
    expect(friends[0]?.id).toBe("a");
  });
  it("snaps each third of the navigation to its own menu", () => {
    expect([0, 0.2, 0.4, 0.6, 0.8, 1].map(navigationIndex)).toEqual([0, 0, 1, 1, 2, 2]);
  });
  it("covers all Germany only at the maximum radius", () => {
    expect(isAllGermany(RADIUS_MAX_KM)).toBe(true);
    expect(isAllGermany(RADIUS_MAX_KM - 5)).toBe(false);
  });
  it("treats events without a start time as all-day", () => {
    expect(isAllDayEvent({ allDay: true, time: "19:00" })).toBe(true);
    expect(isAllDayEvent({ time: "19:00" })).toBe(false);
    expect(isAllDayEvent({})).toBe(true);
  });
  it("labels times or ganztägig for list and detail views", () => {
    expect(formatEventTimeLabel({ allDay: true })).toBe("ganztägig");
    expect(formatEventTimeLabel({ time: "19:00" })).toBe("19:00 Uhr");
    expect(formatEventTimeLabel({ time: "19:00", endTime: "22:30" })).toBe("19:00–22:30 Uhr");
  });
  it("builds an all-day calendar event for the device calendar", () => {
    const now = new Date(Date.UTC(2026, 9, 18, 19, 40, 0));
    const ics = eventToIcs({
      id: "e1",
      title: "Kirmes, Wolfhagen",
      description: "Festzelt\nBlaskapelle",
      place: "Wolfhagen, Hessen",
      date: "2026-10-20",
      lat: 51.326,
      lng: 9.172,
    }, now);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261020");
    expect(ics).toContain("DTEND;VALUE=DATE:20261021");
    expect(ics).toContain("SUMMARY:Kirmes\\, Wolfhagen");
    expect(ics).toContain("DESCRIPTION:Festzelt\\nBlaskapelle");
    expect(ics).toContain("LOCATION:Wolfhagen\\, Hessen");
    expect(ics).toContain("GEO:51.326;9.172");
    expect(ics).toContain(`DTSTAMP:${icsUtcStamp(now)}`);
    expect(ics.endsWith("\r\n")).toBe(true);
  });
  it("builds a timed calendar event and rolls overnight ends to the next day", () => {
    const now = new Date(Date.UTC(2026, 9, 18, 19, 40, 0));
    const timed = eventToIcs({
      id: "e4",
      title: "Konzert",
      description: "Live",
      place: "Hofgeismar",
      date: "2026-10-20",
      time: "19:00",
      endTime: "22:30",
      lat: 51.496,
      lng: 9.385,
    }, now);
    expect(timed).toContain("DTSTART:20261020T190000");
    expect(timed).toContain("DTEND:20261020T223000");
    expect(timed).not.toContain("VALUE=DATE");
    const overnight = eventToIcs({
      id: "e8",
      title: "Nacht",
      description: "",
      place: "Celle",
      date: "2026-10-20",
      time: "22:00",
      endTime: "01:00",
      lat: 52.625,
      lng: 10.08,
    }, now);
    expect(overnight).toContain("DTSTART:20261020T220000");
    expect(overnight).toContain("DTEND:20261021T010000");
    expect(addHoursToIso("2026-10-20", "23:00", 2)).toEqual({ date: "2026-10-21", time: "01:00" });
    expect(icsLocalStamp("2026-10-20", "09:05")).toBe("20261020T090500");
    const openEnd = eventToIcs({
      id: "e5",
      title: "Lauf",
      description: "",
      place: "Melsungen",
      date: "2026-10-20",
      time: "10:00",
      lat: 51.13,
      lng: 9.548,
    }, now);
    expect(openEnd).toContain("DTSTART:20261020T100000");
    expect(openEnd).toContain("DTEND:20261020T120000");
  });
  it("matches weekly and yearly repetitions inside a date filter", () => {
    const church = { date: "2026-10-18", repeat: "weekly" };
    expect(eventOccursOn(church, "2026-10-18")).toBe(true);
    expect(eventOccursOn(church, "2026-10-19")).toBe(false);
    expect(eventOccursOn(church, "2026-10-25")).toBe(true);
    expect(eventOccursInRange(church, "2026-10-25", "2026-10-25")).toBe(true);
    expect(eventOccursInRange(church, "2026-10-19", "2026-10-24")).toBe(false);
    expect(nextOccurrence(church, "2026-10-19")).toBe("2026-10-25");
    const kirmes = { date: "2026-10-21", repeat: "yearly" };
    expect(eventOccursOn(kirmes, "2027-10-21")).toBe(true);
    expect(eventOccursOn(kirmes, "2027-10-22")).toBe(false);
    expect(eventOccursInRange(kirmes, "2027-10-01", "2027-10-31")).toBe(true);
    expect(eventOccursOn({ date: "2024-02-29", repeat: "yearly" }, "2025-02-28")).toBe(false);
    expect(repeatDescription(church)).toBe("Wiederholt sich jeden Sonntag.");
  });
  it("adds a calendar repeat rule for recurring events", () => {
    const ics = eventToIcs({
      id: "e11",
      title: "Gottesdienst",
      description: "",
      place: "Fritzlar",
      date: "2026-10-18",
      time: "10:00",
      repeat: "weekly",
      lat: 51.133,
      lng: 9.28,
    }, new Date(Date.UTC(2026, 9, 18, 12)));
    expect(ics).toContain("RRULE:FREQ=WEEKLY");
    expect(ics).toContain("DTSTART:20261018T100000");
  });
  it("turns the next calendar day without using the local timezone", () => {
    expect(nextIsoDate("2026-12-31")).toBe("2027-01-01");
  });
  it("escapes ICS special characters and names the download from the title", () => {
    expect(icsEscape("A;B,C\\D\nE")).toBe("A\\;B\\,C\\\\D\\nE");
    expect(icsFilename("Kirmes Wolfhagen!")).toBe("Kirmes-Wolfhagen.ics");
    expect(icsFilename("***")).toBe("eventox-event.ics");
  });
});