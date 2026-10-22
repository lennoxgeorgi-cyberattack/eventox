import { createFileRoute } from "@tanstack/react-router";

async function eventsApi() {
  return import("@/server/events.server");
}

function tokenFrom(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const query = new URL(request.url).searchParams.get("q") ?? "";
        const { listStoredEvents } = await eventsApi();
        const result = await listStoredEvents(query, tokenFrom(request));
        if (!result.ok) return Response.json({ error: result.error, events: [] }, { status: result.status });
        return Response.json({ events: result.events });
      },
      POST: async ({ request }) => {
        const accessToken = tokenFrom(request);
        if (!accessToken) return Response.json({ error: "Melde dich an, um ein Event zu veröffentlichen." }, { status: 401 });
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Ungültige Event-Daten." }, { status: 400 });
        }
        const { saveStoredEvent } = await eventsApi();
        const result = await saveStoredEvent(body, accessToken);
        if (!result.ok) return Response.json({ error: result.error }, { status: result.status ?? 400 });
        return Response.json({ event: result.event }, { status: 201 });
      },
    },
  },
});
