import { createFileRoute } from "@tanstack/react-router";

async function bot() {
  return import("@/server/grok-import.server");
}

/**
 * Startet den Grok-Bot für die Seiten aus src/server/import-sources.ts.
 * POST /api/grok-import
 * Authorization: Bearer <IMPORT_TOKEN>
 * Optional: { "sourceIds": ["stadt-beispiel"] }
 */
export const Route = createFileRoute("/api/grok-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.IMPORT_TOKEN?.trim();
        const header = request.headers.get("authorization") ?? "";
        if (!expected) return Response.json({ error: "IMPORT_TOKEN ist noch nicht gesetzt." }, { status: 503 });
        if (header !== `Bearer ${expected}`) return Response.json({ error: "Import nicht erlaubt." }, { status: 401 });
        let sourceIds: string[] | undefined;
        const raw = await request.text();
        if (raw.trim()) {
          try {
            const body = JSON.parse(raw) as { sourceIds?: unknown };
            if (Array.isArray(body.sourceIds)) sourceIds = body.sourceIds.filter((id): id is string => typeof id === "string");
          } catch {
            return Response.json({ error: "Ungültige Import-Daten." }, { status: 400 });
          }
        }
        const { runGrokImport } = await bot();
        const result = await runGrokImport(sourceIds);
        if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
        return Response.json(result);
      },
    },
  },
});
