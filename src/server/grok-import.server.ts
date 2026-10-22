import { htmlToText, importExternalId, parseGrokEvents, publicHttpsUrl } from "@/lib/grok-import";
import { CATEGORIES } from "@/lib/events";
import { importEvents } from "@/server/events.server";
import { IMPORT_SOURCES, type ImportSource } from "@/server/import-sources";

const MODEL = () => process.env.XAI_MODEL?.trim() || "grok-3-mini";

export async function runGrokImport(sourceIds?: string[]) {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return { ok: false as const, error: "XAI_API_KEY ist noch nicht gesetzt.", status: 503 };
  const wanted = new Set((sourceIds ?? []).map((id) => id.trim()).filter(Boolean));
  const sources = IMPORT_SOURCES.filter((source) => wanted.size === 0 || wanted.has(source.id));
  if (sources.length === 0) {
    return { ok: true as const, pages: [] as PageResult[], note: "In src/server/import-sources.ts sind noch keine Seiten eingetragen." };
  }
  const pages: PageResult[] = [];
  for (const source of sources) {
    pages.push(await importSource(source, key));
  }
  return { ok: true as const, pages };
}

type PageResult = { id: string; url: string; error?: string; imported?: unknown; skipped?: unknown };

async function importSource(source: ImportSource, key: string): Promise<PageResult> {
  if (!publicHttpsUrl(source.url)) return { id: source.id, url: source.url, error: "Diese Adresse ist nicht erlaubt." };
  const page = await readPublicPage(source.url);
  if (!page.ok) return { id: source.id, url: source.url, error: page.error };
  const extracted = await askGrok(key, source, page.text);
  if (!extracted.ok) return { id: source.id, url: source.url, error: extracted.error };
  const events = [];
  for (const raw of extracted.events) {
    if (raw == null || typeof raw !== "object") continue;
    const body = raw as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title : "";
    const date = typeof body.date === "string" ? body.date : "";
    const place = typeof body.place === "string" ? body.place : "";
    const located = await withCoordinates(body);
    if (!located) continue;
    events.push({ ...located, externalId: importExternalId(source.id, { title, date, place }) });
  }
  const saved = await importEvents(source.id, source.url, events);
  if (!saved.ok) return { id: source.id, url: source.url, error: saved.error };
  return { id: source.id, url: source.url, imported: saved.imported, skipped: saved.skipped };
}

async function askGrok(key: string, source: ImportSource, text: string) {
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: MODEL(),
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `Lies nur den mitgelieferten Seitentext. Antworte ausschließlich mit JSON {"events":[...]}. Jedes Event braucht title, place, date (YYYY-MM-DD), category aus ${CATEGORIES.join(", ")}, allDay oder time (HH:MM). Optional: description, endTime, repeat (daily, weekly, monthly, yearly), lat, lng. Erfinde keine Events, Orte oder Koordinaten. Wenn etwas fehlt, lass das Event weg.`,
          },
          { role: "user", content: JSON.stringify({ source: source.name, url: source.url, text: text.slice(0, 14000) }) },
        ],
      }),
    });
    if (!response.ok) return { ok: false as const, error: "Grok konnte die Seite nicht lesen." };
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return { ok: true as const, events: parseGrokEvents(body.choices?.[0]?.message?.content ?? "") };
  } catch {
    return { ok: false as const, error: "Grok konnte die Seite nicht lesen." };
  }
}

async function withCoordinates(body: Record<string, unknown>) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return body;
  const place = typeof body.place === "string" ? body.place.trim() : "";
  if (!place) return null;
  const found = await geocodePlace(place);
  if (!found) return null;
  return { ...body, lat: found.lat, lng: found.lng };
}

async function geocodePlace(place: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", place);
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "EventoxImport/1.0 (public event calendar import)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as { lat?: string; lon?: string }[];
    const lat = Number(rows[0]?.lat);
    const lng = Number(rows[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function readPublicPage(value: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let current = publicHttpsUrl(value);
  if (!current) return { ok: false, error: "Diese Adresse ist nicht erlaubt." };
  for (let hop = 0; hop < 3; hop += 1) {
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(12000),
        headers: { accept: "text/html,text/plain", "user-agent": "EventoxImport/1.0" },
      });
    } catch {
      return { ok: false, error: "Die Seite ist nicht erreichbar." };
    }
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next) return { ok: false, error: "Weiterleitung ohne Ziel." };
      current = publicHttpsUrl(new URL(next, current).toString());
      if (!current) return { ok: false, error: "Weiterleitung ist nicht erlaubt." };
      continue;
    }
    if (!response.ok) return { ok: false, error: "Seite konnte nicht geladen werden." };
    const raw = (await response.text()).slice(0, 800_000);
    return { ok: true, text: htmlToText(raw) };
  }
  return { ok: false, error: "Zu viele Weiterleitungen." };
}
