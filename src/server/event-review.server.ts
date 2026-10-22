import { isExpiredOneTimeEvent, reviewEvent, type ReviewEvent } from "@/lib/event-review";

const MODEL = () => process.env.XAI_MODEL?.trim() || "grok-3-mini";

export async function reviewStoredEvent(input: ReviewEvent, existing: ReviewEvent[], today: string) {
  const local = reviewEvent(input, existing, today);
  if (!local.ok) return local;
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return local;
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL(),
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Prüfe ein Event für eine deutsche Dorffest-Karte. Antworte nur mit JSON {\"allow\":true} oder {\"allow\":false,\"reason\":\"kurzer deutscher Satz\"}. Lehne Duplikate, Spam, Unsinn und unplausible Orte oder Daten ab.",
          },
          { role: "user", content: JSON.stringify({ event: input, today }) },
        ],
      }),
    });
    if (!response.ok) return local;
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as { allow?: boolean; reason?: string };
    if (parsed.allow === false) return { ok: false as const, error: parsed.reason?.trim() || "Die Prüfung hat das Event abgelehnt." };
    return local;
  } catch {
    return local;
  }
}

export { isExpiredOneTimeEvent };
