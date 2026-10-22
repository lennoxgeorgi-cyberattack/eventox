import { parseEventInput, type StoredEvent } from "@/lib/event-input";
import type { EventItem } from "@/lib/events";
import { supabasePublic, supabaseAsUser, supabaseService } from "@/lib/supabase";
import { reviewStoredEvent } from "@/server/event-review.server";

type EventRow = {
  id: string;
  owner_id: string | null;
  title: string;
  description: string;
  category: EventItem["category"];
  date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  repeat: EventItem["repeat"] | null;
  place: string;
  lat: number;
  lng: number;
  gold: boolean;
  image: string | null;
  source: string | null;
  source_url: string | null;
  source_external_id: string | null;
};

const SETUP = "Supabase ist noch nicht eingerichtet.";

function rowToEvent(row: EventRow, ownerId?: string): EventItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    category: row.category,
    date: row.date.slice(0, 10),
    allDay: row.all_day,
    time: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    repeat: row.repeat ?? undefined,
    place: row.place,
    lat: row.lat,
    lng: row.lng,
    gold: row.gold,
    image: row.image ?? undefined,
    own: Boolean(ownerId && row.owner_id === ownerId),
    source: row.source ?? undefined,
    sourceUrl: row.source_url ?? undefined,
  };
}

function toRow(event: StoredEvent, ownerId: string | null, source?: { source: string; sourceUrl?: string; externalId: string }) {
  return {
    id: event.id,
    owner_id: ownerId,
    title: event.title,
    description: event.description,
    category: event.category,
    date: event.date,
    all_day: Boolean(event.allDay),
    start_time: event.time ?? null,
    end_time: event.endTime ?? null,
    repeat: event.repeat ?? null,
    place: event.place,
    lat: event.lat,
    lng: event.lng,
    gold: Boolean(event.gold),
    image: event.image ?? null,
    source: source?.source ?? null,
    source_url: source?.sourceUrl ?? null,
    source_external_id: source?.externalId ?? null,
  };
}

async function purge(client: NonNullable<ReturnType<typeof supabasePublic>>) {
  await client.rpc("purge_expired_events");
}

export async function listStoredEvents(query = "", accessToken = "") {
  const client = supabasePublic();
  if (!client) return { ok: false as const, error: SETUP, status: 503, events: [] as EventItem[] };
  let ownerId = "";
  if (accessToken) {
    const userClient = supabaseAsUser(accessToken);
    const user = userClient ? await userClient.auth.getUser(accessToken) : null;
    ownerId = user?.data.user?.id ?? "";
  }
  await purge(client);
  let request = client.from("events").select("*").limit(500);
  const words = query.trim();
  if (words) {
    const safe = words.replace(/[%_,]/g, "");
    request = request.or(`title.ilike.%${safe}%,place.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  const { data, error } = await request;
  if (error) return { ok: false as const, error: "Events konnten nicht geladen werden.", status: 500, events: [] as EventItem[] };
  return { ok: true as const, events: ((data ?? []) as EventRow[]).map((row) => rowToEvent(row, ownerId)) };
}

async function existingForReview(client: NonNullable<ReturnType<typeof supabasePublic>>) {
  const { data } = await client.from("events").select("title,place,date,lat,lng").limit(500);
  return (data ?? []) as { title: string; place: string; date: string; lat: number; lng: number }[];
}

export async function saveStoredEvent(input: unknown, accessToken: string) {
  const client = supabaseAsUser(accessToken);
  if (!client) return { ok: false as const, error: SETUP, status: 503 };
  const { data: userData, error: userError } = await client.auth.getUser(accessToken);
  if (userError || !userData.user) return { ok: false as const, error: "Melde dich an, um ein Event zu veröffentlichen.", status: 401 };
  const parsed = parseEventInput(input);
  if (!parsed.ok) return { ...parsed, status: 400 };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const existing = await existingForReview(client);
  const review = await reviewStoredEvent(parsed.event, existing, today);
  if (!review.ok) return { ...review, status: 400 };
  const { data, error } = await client.from("events").insert(toRow(parsed.event, userData.user.id)).select("*").single();
  if (error || !data) return { ok: false as const, error: "Das Event konnte nicht gespeichert werden.", status: 500 };
  return { ok: true as const, event: rowToEvent(data as EventRow, userData.user.id) };
}

export type ImportResult = { externalId: string; error?: string; id?: string };

export async function importEvents(source: string, sourceUrl: string | undefined, rawEvents: unknown[]) {
  const client = supabaseService();
  if (!client) return { ok: false as const, error: "Der Import braucht den Supabase Service-Role-Schlüssel.", status: 503 };
  await purge(client);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const existing = await existingForReview(client);
  const imported: ImportResult[] = [];
  const skipped: ImportResult[] = [];
  for (const raw of rawEvents) {
    const body = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const externalId = typeof body.externalId === "string" ? body.externalId.trim() : "";
    if (!source.trim() || !externalId) {
      skipped.push({ externalId, error: "Quelle oder externe ID fehlt." });
      continue;
    }
    const { data: known } = await client.from("events").select("id").eq("source", source).eq("source_external_id", externalId).maybeSingle();
    if (known?.id) {
      skipped.push({ externalId, error: "Dieses Event wurde aus dieser Quelle schon importiert." });
      continue;
    }
    const parsed = parseEventInput(raw);
    if (!parsed.ok) {
      skipped.push({ externalId, error: parsed.error });
      continue;
    }
    const review = await reviewStoredEvent(parsed.event, existing, today);
    if (!review.ok) {
      skipped.push({ externalId, error: review.error });
      continue;
    }
    const { data, error } = await client.from("events").insert(toRow(parsed.event, null, { source, sourceUrl, externalId })).select("id,title,place,date,lat,lng").single();
    if (error || !data) {
      skipped.push({ externalId, error: "Speichern ist fehlgeschlagen." });
      continue;
    }
    existing.push(data as { title: string; place: string; date: string; lat: number; lng: number });
    imported.push({ externalId, id: data.id as string });
  }
  return { ok: true as const, imported, skipped };
}
