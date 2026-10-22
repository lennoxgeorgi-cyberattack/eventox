import { useState } from "react";
import { Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

type Place = { place_id: number; display_name: string; lat: string; lon: string };
export function PlaceSearch({ onSelect }: { onSelect: (pos: [number, number], name: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const search = async () => {
    if (!query.trim() || busy) return;
    setBusy(true); setResults([]); setMessage("");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=de&limit=5&q=${encodeURIComponent(query)}&accept-language=de`);
      if (!response.ok) throw new Error("search");
      const places: Place[] = await response.json();
      setResults(places);
      if (!places.length) setMessage("Kein Ort gefunden. Bitte genauer suchen.");
    } catch { setMessage("Ortssuche gerade nicht verfügbar. Wähle den Ort auf der Karte."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
      <input aria-label="Ort oder Adresse" placeholder="Ort oder Adresse in Deutschland" className="min-w-0 flex-1 rounded-lg border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={160} />
      <Button type="submit" size="icon" aria-label="Ort suchen" title="Ort suchen" disabled={busy || !query.trim()}><Search /></Button>
    </form>
    {busy && <p className="text-sm text-muted-foreground">Orte werden gesucht…</p>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    {results.map((p) => <Button key={p.place_id} variant="ghost" className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => onSelect([Number(p.lat), Number(p.lon)], p.display_name.split(",")[0] ?? p.display_name)}><MapPin className="shrink-0" />{p.display_name}</Button>)}
  </div>;
}