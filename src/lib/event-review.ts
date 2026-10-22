export type ReviewEvent = {
  title: string;
  description?: string;
  place: string;
  date: string;
  lat: number;
  lng: number;
};

const GERMANY = { minLat: 47.2, maxLat: 55.2, minLng: 5.8, maxLng: 15.1 };
const NONSENSE = /^(test|asdf|xxx+|event|titel|probe|hallo|abc)$/i;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, " ").trim();
}

export function reviewEvent(input: ReviewEvent, existing: ReviewEvent[], today: string): { ok: true } | { ok: false; error: string } {
  const title = input.title.trim();
  const description = input.description?.trim() ?? "";
  if (title.length < 3 || NONSENSE.test(title)) return { ok: false, error: "Der Titel ergibt keinen Sinn." };
  if (/(.)\1{7,}/.test(title + description) || (title.match(/https?:\/\//gi)?.length ?? 0) > 1) {
    return { ok: false, error: "Das Event wirkt wie Spam." };
  }
  if (input.lat < GERMANY.minLat || input.lat > GERMANY.maxLat || input.lng < GERMANY.minLng || input.lng > GERMANY.maxLng) {
    return { ok: false, error: "Der Ort liegt außerhalb von Deutschland." };
  }
  const year = Number(input.date.slice(0, 4));
  const todayYear = Number(today.slice(0, 4));
  if (Number.isFinite(year) && year > todayYear + 3) return { ok: false, error: "Das Datum liegt unplausibel weit in der Zukunft." };
  const key = normalize(title);
  const duplicate = existing.some((event) => {
    if (event.date !== input.date || normalize(event.title) !== key) return false;
    const lat = event.lat - input.lat;
    const lng = event.lng - input.lng;
    return lat * lat + lng * lng < 0.02;
  });
  if (duplicate) return { ok: false, error: "Dieses Event gibt es dort an dem Tag schon." };
  return { ok: true };
}

export function isExpiredOneTimeEvent(event: { date: string; repeat?: string | null }, today: string) {
  return !event.repeat && event.date < today;
}
