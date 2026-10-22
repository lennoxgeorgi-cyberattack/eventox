export const CATEGORIES = [
  "Fest", "Kirmes", "Markt", "Flohmarkt", "Musik", "Sport", "Kultur", "Kirche",
  "Familie", "Kinder", "Natur", "Essen", "Party", "Workshop", "Andere",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const REPEATS = ["none", "daily", "weekly", "monthly", "yearly"] as const;
export type Repeat = (typeof REPEATS)[number];

export type EventItem = {
  id: string;
  title: string;
  description: string;
  category: Category;
  date: string; // YYYY-MM-DD
  /** When true, or when no start time is set, the event lasts the whole day. */
  allDay?: boolean;
  /** Start time as HH:MM; required unless the event is all-day. */
  time?: string;
  /** Optional end time as HH:MM for timed events. */
  endTime?: string;
  /** Missing or "none" means the event happens once. */
  repeat?: Exclude<Repeat, "none">;
  place: string;
  lat: number;
  lng: number;
  gold?: boolean;
  image?: string | undefined;
  own?: boolean;
  source?: string;
  sourceUrl?: string;
};

export type Friend = { id: string; name: string; favorites: string[]; pinned?: boolean };

const d = (offset: number) => {
  const x = new Date();
  x.setDate(x.getDate() + offset);
  return x.toISOString().slice(0, 10);
};
const nextWeekday = (weekday: number) => {
  const x = new Date();
  x.setDate(x.getDate() + ((weekday - x.getDay() + 7) % 7));
  return x.toISOString().slice(0, 10);
};

export const SAMPLE_EVENTS: EventItem[] = [
  { id: "e1", title: "Kirmes Wolfhagen", description: "Traditionelle Kirmes mit Festzelt, Blaskapelle und Karussell.", category: "Kirmes", date: d(2), allDay: true, repeat: "yearly", place: "Wolfhagen", lat: 51.326, lng: 9.172, gold: true },
  { id: "e2", title: "Bauernmarkt am Dorfplatz", description: "Regionale Produkte, Käse, Honig und frisches Brot.", category: "Markt", date: d(1), time: "08:00", endTime: "13:00", place: "Baunatal", lat: 51.255, lng: 9.418 },
  { id: "e3", title: "Feuerwehrfest Calden", description: "Fahrzeugschau, Grillstand und Kinderprogramm.", category: "Fest", date: d(5), allDay: true, place: "Calden", lat: 51.409, lng: 9.383 },
  { id: "e4", title: "Open Air Scheunenkonzert", description: "Lokale Bands spielen in der alten Scheune.", category: "Musik", date: d(8), time: "19:00", endTime: "22:30", place: "Hofgeismar", lat: 51.496, lng: 9.385 },
  { id: "e5", title: "Dorflauf 10 km", description: "Volkslauf durch Felder und Wald, Anmeldung vor Ort.", category: "Sport", date: d(12), time: "10:00", place: "Melsungen", lat: 51.13, lng: 9.548 },
  { id: "e6", title: "Weinfest an der Mosel", description: "Winzer öffnen ihre Höfe, Live-Musik am Abend.", category: "Fest", date: d(4), allDay: true, place: "Bernkastel-Kues", lat: 49.916, lng: 7.069, gold: true },
  { id: "e7", title: "Maibaum & Blasmusik", description: "Gemütlicher Nachmittag mit Blaskapelle.", category: "Musik", date: d(3), time: "14:00", endTime: "18:00", place: "Murnau", lat: 47.68, lng: 11.2 },
  { id: "e8", title: "Heimatmuseum Nacht", description: "Führungen bei Kerzenlicht und Geschichten.", category: "Kultur", date: d(6), time: "20:00", endTime: "22:00", place: "Celle", lat: 52.625, lng: 10.08 },
  { id: "e9", title: "Erntedankfest", description: "Umzug mit geschmückten Wagen und Festgottesdienst.", category: "Fest", date: d(9), allDay: true, place: "Fritzlar", lat: 51.132, lng: 9.276 },
  { id: "e10", title: "Flohmarkt auf der Wiese", description: "Stöbern, handeln, Kaffee und Kuchen.", category: "Flohmarkt", date: d(0), time: "09:00", endTime: "16:00", place: "Kassel-Harleshausen", lat: 51.338, lng: 9.42 },
  { id: "e11", title: "Sonntagsgottesdienst", description: "Gottesdienst in der Stadtkirche, anschließend Kirchencafé.", category: "Kirche", date: nextWeekday(0), time: "10:00", endTime: "11:00", repeat: "weekly", place: "Fritzlar", lat: 51.133, lng: 9.28 },
];

export const SAMPLE_FRIENDS: Friend[] = [
  { id: "f1", name: "Lena", favorites: ["e1", "e4"] },
  { id: "f2", name: "Jonas", favorites: ["e1", "e3", "e9"] },
];

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const GOLD_PIN_PRICE_EUR = 10;
export const RADIUS_MAX_KM = 500; // slider maximum = ganz Deutschland
export const isAllGermany = (r: number) => r >= RADIUS_MAX_KM;

export function matchesSearch(e: EventItem, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${e.title} ${e.description} ${e.place} ${e.category}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Shrinks an image file to a JPEG data URL so it fits in local storage. */
export function fileToDataUrl(file: File, max = 800): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * k; c.height = img.height * k;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
