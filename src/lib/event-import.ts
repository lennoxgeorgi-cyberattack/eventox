import type { StoredEvent } from "./event-input";

export type ImportDraft = {
  externalId: string;
  event: StoredEvent;
};

export function normalizeImport(source: string, raw: unknown): { ok: true; draft: ImportDraft } | { ok: false; externalId: string; error: string } {
  if (raw == null || typeof raw !== "object") return { ok: false, externalId: "", error: "Ungültiges Import-Event." };
  const body = raw as Record<string, unknown>;
  const externalId = typeof body.externalId === "string" ? body.externalId.trim() : "";
  if (!source.trim()) return { ok: false, externalId, error: "Quelle fehlt." };
  if (!externalId) return { ok: false, externalId, error: "Externe ID fehlt." };
  return { ok: true, draft: { externalId, event: body as StoredEvent } };
}
