import { REPEATS, type EventItem, type Friend, type Repeat } from "./events";

export type DatePreset = "all" | "today" | "tomorrow" | "week" | "day" | "range";
export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function datePresetRange(preset: DatePreset, now = new Date()) {
  const start = new Date(now);
  const end = new Date(now);
  if (preset === "tomorrow") {
    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() + 1);
  }
  if (preset === "week") end.setDate(end.getDate() + (7 - (end.getDay() || 7)));
  if (preset === "all" || preset === "day" || preset === "range") return { from: "", to: "" };
  return { from: localDate(start), to: localDate(end) };
}
export const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: "none", label: "Einmalig" },
  { value: "daily", label: "Täglich" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
  { value: "yearly", label: "Jährlich" },
];

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export function eventRepeat(event: { repeat?: string }): Repeat {
  return REPEATS.includes(event.repeat as Repeat) ? (event.repeat as Repeat) : "none";
}

export function applyEventRepeat<T extends { id: string; repeat?: EventItem["repeat"] }>(event: T, repeats: Record<string, Repeat> = {}) {
  if (!(event.id in repeats)) return event;
  const repeat = repeats[event.id];
  return { ...event, repeat: repeat === "none" ? undefined : repeat };
}

function isoParts(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

function isoFromParts(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const { year, month, day } = isoParts(iso);
  return isoFromParts(year, month, day + days);
}

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
}

function sameCalendarDay(iso: string, year: number, month: number, day: number) {
  const parts = isoParts(iso);
  return parts.year === year && parts.month === month && parts.day === day;
}

export function eventOccursOn(event: { date: string; repeat?: string }, day: string) {
  if (day < event.date) return false;
  const repeat = eventRepeat(event);
  if (repeat === "none") return day === event.date;
  if (repeat === "daily") return true;
  if (repeat === "weekly") return daysBetween(event.date, day) % 7 === 0;
  const start = isoParts(event.date);
  const current = isoParts(day);
  if (repeat === "monthly") return current.day === start.day && sameCalendarDay(day, current.year, current.month, start.day);
  return current.month === start.month && current.day === start.day && sameCalendarDay(day, current.year, start.month, start.day);
}

export function eventOccursInRange(event: { date: string; repeat?: string }, from = "", to = "") {
  if (!from && !to) return true;
  const repeat = eventRepeat(event);
  if (repeat === "none") return (!from || event.date >= from) && (!to || event.date <= to);
  if (to && event.date > to) return false;
  if (!to) return true;
  const start = from && from > event.date ? from : event.date;
  if (start > to) return false;
  if (repeat === "daily") return true;
  if (repeat === "weekly") {
    const gap = daysBetween(event.date, start);
    const offset = gap % 7 === 0 ? 0 : 7 - (gap % 7);
    return addDays(start, offset) <= to;
  }
  const end = isoParts(to);
  const anchor = isoParts(event.date);
  if (repeat === "monthly") {
    let year = isoParts(start).year;
    let month = isoParts(start).month;
    while (year < end.year || (year === end.year && month <= end.month)) {
      const candidate = isoFromParts(year, month, anchor.day);
      if (sameCalendarDay(candidate, year, month, anchor.day) && candidate >= start && candidate <= to) return true;
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    return false;
  }
  for (let year = isoParts(start).year; year <= end.year; year += 1) {
    const candidate = isoFromParts(year, anchor.month, anchor.day);
    if (sameCalendarDay(candidate, year, anchor.month, anchor.day) && candidate >= start && candidate <= to) return true;
  }
  return false;
}

export function nextOccurrence(event: { date: string; repeat?: string }, from: string) {
  if (event.date >= from) return event.date;
  if (eventRepeat(event) === "none") return event.date;
  for (let offset = 0; offset <= 366; offset += 1) {
    const day = addDays(from, offset);
    if (eventOccursOn(event, day)) return day;
  }
  return event.date;
}

export function repeatLabel(event: { repeat?: string }) {
  return REPEAT_OPTIONS.find((option) => option.value === eventRepeat(event))?.label ?? "Einmalig";
}

export function repeatDescription(event: { date: string; repeat?: string }) {
  const repeat = eventRepeat(event);
  if (repeat === "none") return "Findet nur an diesem Tag statt.";
  if (repeat === "daily") return "Wiederholt sich täglich.";
  if (repeat === "weekly") return `Wiederholt sich jeden ${WEEKDAYS[new Date(`${event.date}T12:00:00Z`).getUTCDay()]}.`;
  if (repeat === "monthly") return `Wiederholt sich jeden Monat am ${isoParts(event.date).day}.`;
  const start = new Date(`${event.date}T12:00:00Z`);
  const day = start.toLocaleDateString("de-DE", { day: "numeric", month: "long", timeZone: "UTC" });
  return `Wiederholt sich jedes Jahr am ${day}.`;
}

export const navigationIndex = (fraction: number) => Math.max(0, Math.min(2, Math.floor(fraction * 3)));
export const pinnedFriendsFirst = (friends: Friend[]) => [...friends].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

export function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

export function nextIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1)).toISOString().slice(0, 10);
}

export function icsUtcStamp(now: Date) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function icsFilename(title: string) {
  const base = title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${base || "eventox-event"}.ics`;
}

export type EventWhen = Pick<EventItem, "date" | "allDay" | "time" | "endTime">;

export function isAllDayEvent(event: Pick<EventItem, "allDay" | "time">) {
  return Boolean(event.allDay) || !event.time;
}

export function formatEventDay(date: string) {
  return new Date(date + "T12:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short" });
}

export function formatEventTimeLabel(event: Pick<EventItem, "allDay" | "time" | "endTime">) {
  if (isAllDayEvent(event) || !event.time) return "ganztägig";
  if (event.endTime) return `${event.time}–${event.endTime} Uhr`;
  return `${event.time} Uhr`;
}

export function formatEventWhen(event: EventWhen & { repeat?: string }, from = "") {
  const day = eventRepeat(event) === "none" ? event.date : nextOccurrence(event, from || event.date);
  const when = `${formatEventDay(day)} · ${formatEventTimeLabel(event)}`;
  return eventRepeat(event) === "none" ? when : `${when} · ${repeatLabel(event)}`;
}

export function icsLocalStamp(date: string, time: string) {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

export function addHoursToIso(date: string, time: string, hours: number) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const dt = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0));
  dt.setUTCHours(dt.getUTCHours() + hours);
  return { date: dt.toISOString().slice(0, 10), time: dt.toISOString().slice(11, 16) };
}

function icsTimeRange(event: EventWhen) {
  if (isAllDayEvent(event) || !event.time) {
    return {
      start: `DTSTART;VALUE=DATE:${event.date.replaceAll("-", "")}`,
      end: `DTEND;VALUE=DATE:${nextIsoDate(event.date).replaceAll("-", "")}`,
    };
  }
  const end = event.endTime
    ? event.endTime <= event.time
      ? { date: nextIsoDate(event.date), time: event.endTime }
      : { date: event.date, time: event.endTime }
    : addHoursToIso(event.date, event.time, 2);
  return {
    start: `DTSTART:${icsLocalStamp(event.date, event.time)}`,
    end: `DTEND:${icsLocalStamp(end.date, end.time)}`,
  };
}

export function eventToIcs(event: Pick<EventItem, "id" | "title" | "description" | "place" | "date" | "lat" | "lng" | "allDay" | "time" | "endTime" | "repeat">, now = new Date()) {
  const range = icsTimeRange(event);
  const repeat = eventRepeat(event);
  const rule = repeat === "none" ? "" : `RRULE:FREQ=${repeat === "daily" ? "DAILY" : repeat === "weekly" ? "WEEKLY" : repeat === "monthly" ? "MONTHLY" : "YEARLY"}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eventox//Event-Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@eventox.app`,
    `DTSTAMP:${icsUtcStamp(now)}`,
    range.start,
    range.end,
    ...(rule ? [rule] : []),
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description)}`,
    `LOCATION:${icsEscape(event.place)}`,
    `GEO:${event.lat};${event.lng}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
}