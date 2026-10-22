import { createFileRoute } from "@tanstack/react-router";

async function eventsApi() {
  return import("@/server/events.server");
}

/**
 * Endpoint für einen späteren Grok-Bot.
 * POST /api/imports
 * Authorization: Bearer <IMPORT_TOKEN>
 * { "source": "kalender-name", "sourceUrl": "https://...", "events": [{ "externalId": "abc", ...event }] }
 * Jedes Event durchläuft dieselbe Duplikat- und Plausibilitätsprüfung und speichert Quelle plus externe ID.
 */
export const Route = createFileRoute("/api/imports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.IMPORT_TOKEN?.trim();
        const header = request.headers.get("authorization") ?? "";
        if (!expected) return Response.json({ error: "IMPORT_TOKEN ist noch nicht gesetzt." }, { status: 503 });
        if (header !== `Bearer ${expected}`) return Response.json({ error: "Import nicht erlaubt." }, { status: 401 });
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Ungültige Import-Daten." }, { status: 400 });
        }
        const record = body != null && typeof body === "object" ? (body as Record<string, unknown>) : {};
        const source = typeof record.source === "string" ? record.source.trim() : "";
        const sourceUrl = typeof record.sourceUrl === "string" ? record.sourceUrl.trim() : undefined;
        const events = Array.isArray(record.events) ? record.events : null;
        if (!source || !events) return Response.json({ error: "Quelle und Events fehlen." }, { status: 400 });
        const { importEvents } = await eventsApi();
        const result = await importEvents(source, sourceUrl, events);
        if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
        return Response.json({ imported: result.imported, skipped: result.skipped });
      },
    },
  },
});
