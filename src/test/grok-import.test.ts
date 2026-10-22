import { describe, expect, it } from "vitest";
import { htmlToText, importExternalId, parseGrokEvents, publicHttpsUrl } from "@/lib/grok-import";

describe("grok import sources", () => {
  it("allows only public https pages", () => {
    expect(publicHttpsUrl("https://www.kassel.de/veranstaltungen")?.hostname).toBe("www.kassel.de");
    expect(publicHttpsUrl("http://www.kassel.de")).toBeNull();
    expect(publicHttpsUrl("https://localhost/events")).toBeNull();
    expect(publicHttpsUrl("https://192.168.2.121/events")).toBeNull();
    expect(publicHttpsUrl("https://user:pass@example.de")).toBeNull();
  });

  it("reads events from a fenced grok answer and keeps a stable source id", () => {
    const events = parseGrokEvents('```json\n{"events":[{"title":"Kirmes","date":"2026-10-25","place":"Fritzlar"}]}\n```');
    expect(events).toHaveLength(1);
    expect(importExternalId("stadt", { title: "Kirmes", date: "2026-10-25", place: "Fritzlar" })).toBe(
      importExternalId("stadt", { title: "Kirmes!", date: "2026-10-25", place: "Fritzlar" }),
    );
    expect(htmlToText("<style>a{}</style><p>Dorffest</p>")).toBe("Dorffest");
  });
});
