import { CATEGORIES, REPEATS, type Category, type EventItem, type Repeat } from "./events";

export type StoredEvent = Omit<EventItem, "own">;

const OLD_CATEGORIES: Record<string, Category> = {
  Dorffest: "Fest",
  Weinfest: "Fest",
  Bierfest: "Fest",
  Schützenfest: "Fest",
  Feuerwehr: "Fest",
  Weihnachtsmarkt: "Markt",
  Kunst: "Kultur",
  Theater: "Kultur",
  Senioren: "Familie",
  Tiere: "Natur",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_IMAGE = 1_500_000;

export type EventInputResult = { ok: true; event: StoredEvent } | { ok: false; error: string };

export type PublishDraft = {
  title: string;
  place: string;
  date: string;
  category: string;
  allDay: boolean;
  time: string;
  lat: number;
  lng: number;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validDate(value: string) {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return date.getUTCFullYear() === year && date.getUTCMonth() === (month ?? 1) - 1 && date.getUTCDate() === day;
}

function validCoordinates(lat: number, lng: number) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/** Plain German names of everything still required before an event can be published. */
export function missingPublishFields(draft: PublishDraft): string[] {
  const missing: string[] = [];
  if (!draft.title.trim()) missing.push("Titel");
  if (!draft.place.trim()) missing.push("Ort");
  if (!validDate(draft.date.trim())) missing.push("Datum");
  if (!CATEGORIES.includes(draft.category as Category)) missing.push("Kategorie");
  if (!draft.allDay && !TIME.test(draft.time.trim())) missing.push("Beginn (oder Ganztägig)");
  if (!validCoordinates(draft.lat, draft.lng)) missing.push("Ort auf der Karte");
  return missing;
}

export function publishBlockerMessage(missing: string[]) {
  if (missing.length === 0) return "";
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} und ${missing[missing.length - 1]}`;
  return `Zum Veröffentlichen fehlt noch: ${list}.`;
}

export function parseEventInput(input: unknown, id = crypto.randomUUID()): EventInputResult {
  if (input == null || typeof input !== "object") return { ok: false, error: "Ungültige Event-Daten." };
  const body = input as Record<string, unknown>;
  const title = text(body.title, 80);
  const place = text(body.place, 60);
  const description = text(body.description, 500);
  const date = text(body.date, 10);
  const category = OLD_CATEGORIES[text(body.category, 40)] ?? text(body.category, 40);
  const allDay = body.allDay === true;
  const time = text(body.time, 5);
  const endTime = text(body.endTime, 5);
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const givenId = text(body.id, 80);
  const repeat = REPEATS.includes(body.repeat as Repeat) ? (body.repeat as Repeat) : "none";

  if (!title) return { ok: false, error: "Titel fehlt." };
  if (!place) return { ok: false, error: "Ort fehlt." };
  if (!validDate(date)) return { ok: false, error: "Datum ist ungültig." };
  if (!CATEGORIES.includes(category as Category)) return { ok: false, error: "Kategorie ist ungültig." };
  if (!allDay && !TIME.test(time)) return { ok: false, error: "Beginn fehlt oder ist ungültig." };
  if (!allDay && endTime && !TIME.test(endTime)) return { ok: false, error: "Ende ist ungültig." };
  if (!validCoordinates(lat, lng)) return { ok: false, error: "Koordinaten sind ungültig." };
  let image: string | undefined;
  if (body.image != null && body.image !== "") {
    if (typeof body.image !== "string" || !body.image.startsWith("data:image/") || body.image.length > MAX_IMAGE) {
      return { ok: false, error: "Bild ist ungültig oder zu groß." };
    }
    image = body.image;
  }

  return {
    ok: true,
    event: {
      id: givenId || id,
      title,
      description,
      place,
      date,
      category: category as Category,
      allDay,
      time: allDay ? undefined : time,
      endTime: allDay || !endTime ? undefined : endTime,
      repeat: repeat === "none" ? undefined : repeat,
      lat,
      lng,
      gold: body.gold === true,
      image,
    },
  };
}
