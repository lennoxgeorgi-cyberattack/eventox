import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Heart, List, Map as MapIcon, Users, Plus, SlidersHorizontal, X, MapPin, Calendar, Crown, Trash2, Search, ImagePlus, Camera, LocateFixed, Pin, ChevronDown, Eye, EyeOff } from "lucide-react";
import { CATEGORIES, GOLD_PIN_PRICE_EUR, RADIUS_MAX_KM, distanceKm, fileToDataUrl, isAllGermany, matchesSearch, type Category, type EventItem, type Repeat } from "@/lib/events";
import { CategoryIcon } from "@/icons/category-icons";
import { acceptFriendRequest, addEvent, declineFriendRequest, removeFriend, requestFriend, setProfile, signIn, signOut, signUp, toggleFavorite, togglePinFriend, useStore } from "@/lib/store";

import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlaceSearch } from "@/components/PlaceSearch";
import { TimeMenu } from "@/components/TimeMenu";
import { ImageCrop } from "@/components/ImageCrop";
import { datePresetRange, eventOccursInRange, eventToIcs, formatEventWhen, icsFilename, localDate, navigationIndex, nextOccurrence, pinnedFriendsFirst, REPEAT_OPTIONS, repeatDescription, type DatePreset } from "@/lib/event-controls";
import { missingPublishFields, publishBlockerMessage } from "@/lib/event-input";

const MapView = lazy(() => import("@/components/MapView"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eventox – Dorffeste & Events in deiner Nähe" },
      { name: "description", content: "Finde Dorffeste, Märkte und kleine Veranstaltungen in deiner Nähe in ganz Deutschland." },
      { property: "og:title", content: "Eventox – Events in deiner Nähe" },
      { property: "og:description", content: "Dorffeste und lokale Veranstaltungen auf der Karte entdecken, favorisieren und mit Freunden teilen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const DEFAULT_CENTER: [number, number] = [51.312, 9.479]; // Kassel
type Tab = "map" | "list" | "friends";

function Index() {
  const store = useStore();
  const [hydrated, setHydrated] = useState(false);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [tab, setTab] = useState<Tab>("map");
  const [radius, setRadius] = useState(50);
  const [locationOutside, setLocationOutside] = useState(false);
  const [returnRequest, setReturnRequest] = useState(0);
  const [pickedPlace, setPickedPlace] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState<[number, number] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authNote, setAuthNote] = useState("");
  const allDE = isAllGermany(radius);
  const searching = query.trim().length > 0;

  useEffect(() => {
    setHydrated(true);
    navigator.geolocation?.getCurrentPosition((p) => setCenter([p.coords.latitude, p.coords.longitude]));
  }, []);
  useEffect(() => {
    if (!store.authPrompt) return;
    setAuthMode("login");
    setAuthNote("");
    setShowAuth(true);
  }, [store.authPrompt]);
  const openAuth = (mode: "login" | "register" = "login", note = "") => {
    setAuthMode(mode);
    setAuthNote(note);
    setShowAuth(true);
  };

  const today = localDate(new Date());
  const all = store.userEvents;
  const filtered = useMemo(
    () =>
      all
        .map((e) => ({ ...e, dist: distanceKm({ lat: center[0], lng: center[1] }, e) }))
        .filter((e) => (searching ? matchesSearch(e, query) : true))
        // Own events are always visible, even outside the radius
        .filter((e) => searching || allDE || e.own || e.dist <= radius)
        .filter((e) => searching || eventOccursInRange(e, dateFrom, dateTo))
        .filter((e) => searching || !cats.length || cats.includes(e.category))
        .sort((a, b) => Number(!!b.gold) - Number(!!a.gold) || nextOccurrence(a, dateFrom || today).localeCompare(nextOccurrence(b, dateFrom || today)) || (a.time ?? "").localeCompare(b.time ?? "")),
    [all, center, radius, allDE, dateFrom, dateTo, cats, query, searching, today],
  );

  const chooseDate = (preset: DatePreset) => {
    setDatePreset(preset);
    const range = datePresetRange(preset);
    setDateFrom(range.from); setDateTo(range.to);
  };

  const friendsFor = (id: string) => store.friends.filter((f) => f.favorites.includes(id));

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-[500] p-3">
        <div className={`${searchOpen ? "solid-panel" : "glass"} mx-auto flex max-w-xl items-center justify-between gap-2 rounded-full px-4 py-2`}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button variant="ghost" aria-label="Suchen" onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setQuery(""); }}
              className="press bg-gradient-primary grid h-8 w-8 shrink-0 place-items-center rounded-full text-primary-foreground">
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
            {searchOpen ? (
              <input autoFocus placeholder="Suche in ganz Deutschland…" value={query} onChange={(e) => setQuery(e.target.value)}
                className="fade-in min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" maxLength={60} />
            ) : (
              <span className="text-lg font-bold tracking-normal">Eventox</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">{filtered.length} Events{searching ? "" : ` · ${allDE ? "DE" : `${radius} km`}`}</span>
            {store.user ? (
              <Button variant="ghost" aria-label="Profil" onClick={() => setTab("friends")} className="glass h-9 rounded-full px-3 text-xs">{store.profile.name || "Profil"}</Button>
            ) : (
              <Button variant="ghost" onClick={() => openAuth()} className="bg-gradient-primary h-9 rounded-full px-3 text-xs font-medium text-primary-foreground">Anmelden</Button>
            )}
            <Button variant="ghost" aria-label="Filter" onClick={() => setShowFilter(true)} className="glass grid h-9 w-9 place-items-center rounded-full">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {store.setupRequired && <p className="solid-panel mx-auto mt-2 max-w-xl rounded-2xl px-4 py-2 text-center text-xs text-muted-foreground">Supabase ist noch nicht verbunden. Trage die Schlüssel aus dem Projekt in die Umgebungsvariablen ein.</p>}
        {!showFilter && !adding && <div className="solid-panel mx-auto mt-2 max-w-xl rounded-2xl px-4 py-1"><RadiusControl radius={radius} setRadius={setRadius} /></div>}
      </header>

      {/* Main */}
      <main className="relative min-h-0 flex-1">
        {hydrated && <div className={tab === "map" ? "absolute inset-0" : "absolute inset-0 invisible pointer-events-none"}>
          <Suspense fallback={<div className="grid h-full place-items-center text-muted-foreground">Karte lädt…</div>}>
            <MapView center={center} radiusKm={radius} allGermany={allDE || searching} events={filtered} onSelect={setSelected}
              active={tab === "map"} returnRequest={returnRequest} onLocationOutside={setLocationOutside}
              onPick={adding ? (lat, lng) => { setPickedPlace(""); setPick([lat, lng]); } : undefined} />
          </Suspense>
        </div>}
        {tab === "list" && (
          <div className="h-full overflow-y-auto px-3 pb-44 pt-36">
            <div className="mx-auto max-w-xl space-y-3">
              {filtered.length === 0 && <p className="glass rounded-2xl p-6 text-center text-muted-foreground">{searching ? "Keine Treffer für deine Suche." : "Keine Events gefunden. Vergrößere den Radius."}</p>}
              {filtered.map((e) => (
                <div key={e.id} role="button" tabIndex={0} onKeyDown={(ev) => { if (ev.target === ev.currentTarget && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); setSelected(e); } }} onClick={() => setSelected(e)}
                  className={`glass block w-full rounded-2xl p-4 text-left ${e.gold ? "ring-2 ring-gold" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    {e.image && <img src={e.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {e.gold && <Crown className="h-4 w-4 shrink-0 text-gold" />}
                        <h3 className="truncate font-semibold">{e.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{formatEventWhen(e, dateFrom || today)} · {e.place} · {Math.round(e.dist)} km</p>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"><CategoryIcon category={e.category} className="h-3.5 w-3.5 text-primary" /> {e.category}</span>
                      {friendsFor(e.id).length > 0 && <p className="mt-2 text-xs text-primary">♥ {friendsFor(e.id).map((f) => f.name).join(", ")}</p>}
                    </div>
                    <FavButton id={e.id} active={store.favorites.includes(e.id)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "friends" && <FriendsView center={center} onSelect={setSelected} onAuth={() => openAuth()} />}

        {adding && store.user && tab === "map" && !pick && (
          <div className="solid-panel absolute inset-x-3 top-20 z-[500] mx-auto max-w-xl rounded-2xl p-4 text-sm">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Veranstaltungsort</h2><Button variant="ghost" size="icon" aria-label="Ortswahl abbrechen" onClick={() => setAdding(false)}><X /></Button></div>
            <PlaceSearch onSelect={(pos, name) => { setPick(pos); setPickedPlace(name); }} />
            <p className="mt-3 text-muted-foreground">Oder einen Ort auf der Karte wählen.</p>
          </div>
        )}
      </main>

      {tab === "map" && locationOutside && <Button aria-label="Zurück zu meinem Standort" title="Zurück zu meinem Standort" onClick={() => setReturnRequest((v) => v + 1)} className="solid-panel absolute bottom-40 left-4 z-[500] h-12 rounded-full text-foreground"><LocateFixed /> Mein Standort</Button>}

      {/* FAB */}
      <Button variant="ghost" aria-label="Event hinzufügen" onClick={() => { if (!store.user) { openAuth("register", "Lege ein Konto an, um ein Event zu erstellen."); return; } setTab("map"); setAdding(true); setPick(null); setPickedPlace(""); }}
        className="bg-gradient-primary absolute bottom-40 right-4 z-[500] grid h-14 w-14 place-items-center rounded-full text-primary-foreground shadow-lg">
        <Plus className="h-6 w-6" />
      </Button>

      {/* Bottom nav + ad */}
      <div className="absolute inset-x-0 bottom-0 z-[500] space-y-2 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <LiquidNav tab={tab} setTab={setTab} />
        <div className="glass mx-auto flex h-[60px] max-w-xl items-center justify-center rounded-xl text-xs text-muted-foreground" data-ad-slot="eventox-bottom">
          Anzeige
        </div>
      </div>

      {showFilter && (
        <Sheet onClose={() => setShowFilter(false)} title="Filter" footer={<Button variant="ghost" onClick={() => { setShowFilter(false); setTab("map"); }} className="bg-gradient-primary mt-4 h-auto w-full shrink-0 rounded-full py-3 font-medium text-primary-foreground">Filtern</Button>}>
          <RadiusControl radius={radius} setRadius={setRadius} />
          <p className="mt-5 text-sm font-medium">Datum</p>
          <div className="mt-2 flex flex-wrap gap-2">{([["all", "Alle"], ["today", "Heute"], ["tomorrow", "Morgen"], ["week", "Diese Woche"], ["day", "Bestimmter Tag"], ["range", "Zeitraum"]] as const).map(([key, label]) => <Button key={key} variant={datePreset === key ? "default" : "secondary"} aria-pressed={datePreset === key} onClick={() => chooseDate(key)}>{label}</Button>)}</div>
          {(datePreset === "day" || datePreset === "range") && <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label={datePreset === "day" ? "Tag" : "Von"}><input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); if (datePreset === "day") setDateTo(e.target.value); }} className={inputCls} /></Field>
            {datePreset === "range" && <Field label="Bis"><input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className={inputCls} /></Field>}
          </div>}
          <p className="mt-4 text-sm font-medium">Kategorien</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Button variant="ghost" key={c} onClick={() => setCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))}
                className={`press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${cats.includes(c) ? "bg-gradient-primary text-primary-foreground" : "glass"}`}><CategoryIcon category={c} className="h-4 w-4" /> {c}</Button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => { setRadius(50); chooseDate("all"); setCats([]); }} className="mt-5 text-sm text-muted-foreground underline">Zurücksetzen</Button>
        </Sheet>
      )}

      {selected && (
        <Sheet onClose={() => setSelected(null)} title={selected.title} large>
          {selected.image ? <img src={selected.image} alt={selected.title} className="mb-5 aspect-video max-h-80 w-full rounded-lg object-cover" /> : <div className="mb-5 flex h-32 items-center gap-5 rounded-lg bg-secondary px-6"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-primary text-white"><CategoryIcon category={selected.category} className="h-8 w-8" /></span><div><p className="text-lg font-semibold">{selected.category}</p><p className="text-muted-foreground">{selected.place}</p></div></div>}
          {selected.gold && <span className="bg-gradient-gold mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-gold-foreground"><Crown className="h-3 w-3" /> Goldener Pin</span>}
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-4 w-4" /> {formatEventWhen(selected, dateFrom || today)}</p>
          <p className="mt-4 text-sm font-medium">Wiederholung</p>
          <p className="mt-1 text-sm text-muted-foreground">{repeatDescription(selected)}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {selected.place} · <CategoryIcon category={selected.category} className="h-4 w-4 text-primary" /> {selected.category}</p>
          {selected.description.trim() && <p className="mt-3">{selected.description}</p>}
          {friendsFor(selected.id).length > 0 && <p className="mt-3 text-sm text-primary">Favorisiert von: {friendsFor(selected.id).map((f) => f.name).join(", ")}</p>}
          <Button variant="ghost" onClick={() => openDeviceCalendar(selected)} className="glass mt-5 flex h-auto w-full items-center justify-center gap-2 rounded-full py-3 font-medium">
            <Calendar className="h-4 w-4" />
            Zum Kalender hinzufügen
          </Button>
          <Button variant="ghost" onClick={() => toggleFavorite(selected.id)} className="bg-gradient-primary mt-3 flex h-auto w-full items-center justify-center gap-2 rounded-full py-3 font-medium text-primary-foreground">
            <Heart className={`h-4 w-4 ${store.favorites.includes(selected.id) ? "fill-current" : ""}`} />
            {store.favorites.includes(selected.id) ? "Favorisiert" : "Favorisieren"}
          </Button>
        </Sheet>
      )}

      {pick && store.user && <AddEventSheet pos={pick} initialPlace={pickedPlace} center={center} onClose={() => { setPick(null); setAdding(false); }} />}
      {showAuth && <AuthSheet initialMode={authMode} note={authNote} onClose={() => setShowAuth(false)} />}
    </div>
  );
}

const inputCls = "border bg-muted mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function openDeviceCalendar(event: EventItem) {
  const blob = new Blob([eventToIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = icsFilename(event.title);
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Field({ label, optional = false, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return <label className="block text-sm font-medium">{label}{optional && <span className="ml-2 text-xs font-normal text-muted-foreground">optional</span>}{children}</label>;
}

function PasswordField({ value, onChange, autoComplete }: { value: string; onChange: (value: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label="Passwort">
      <div className="relative">
        <input type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} pr-10`} autoComplete={autoComplete} />
        <button type="button" aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"} aria-pressed={visible} onClick={() => setVisible((current) => !current)} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-muted-foreground">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

function FavButton({ id, active }: { id: string; active: boolean }) {
  return (
    <Button variant="ghost" aria-label="Favorisieren" aria-pressed={active} onClick={(ev) => { ev.stopPropagation(); toggleFavorite(id); }}
      className="glass grid h-10 w-10 shrink-0 place-items-center rounded-full">
      <Heart className={`h-5 w-5 text-primary ${active ? "fill-current" : ""}`} />
    </Button>
  );
}

function Sheet({ title, onClose, children, large = false, footer }: { title: string; onClose: () => void; children: React.ReactNode; large?: boolean; footer?: React.ReactNode }) {
  return (
    <div className="fade-in absolute inset-0 z-[1000] flex items-end bg-foreground/20 sm:items-center sm:justify-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`solid-panel max-h-[90dvh] w-full rounded-t-3xl p-5 pb-8 sheet-in sm:rounded-3xl ${footer ? "flex flex-col overflow-hidden" : "overflow-y-auto"} ${large ? "sm:max-w-2xl sm:p-8" : "sm:max-w-md"}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="min-w-0 break-words text-xl font-bold">{title}</h2>
          <Button variant="ghost" aria-label="Schließen" onClick={onClose} className="glass grid h-9 w-9 shrink-0 place-items-center rounded-full"><X className="h-4 w-4" /></Button>
        </div>
        {footer ? <div className="min-h-0 flex-1 overflow-y-auto">{children}</div> : children}
        {footer}
      </div>
    </div>
  );
}

function AddEventSheet({ pos, center, onClose, initialPlace }: { pos: [number, number]; center: [number, number]; onClose: () => void; initialPlace: string }) {
  const [f, setF] = useState({ title: "", description: "", place: initialPlace, date: new Date().toISOString().slice(0, 10), allDay: false, time: "", endTime: "", repeat: "none" as Repeat, category: "Fest" as Category, gold: false, image: undefined as string | undefined });
  const dist = Math.round(distanceKm({ lat: center[0], lng: center[1] }, { lat: pos[0], lng: pos[1] }));
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [triedPublish, setTriedPublish] = useState(false);
  const hasWhen = f.allDay || Boolean(f.time);
  const missing = missingPublishFields({
    title: f.title,
    place: f.place,
    date: f.date,
    category: f.category,
    allDay: f.allDay,
    time: f.time,
    lat: pos[0],
    lng: pos[1],
  });
  const missingMessage = triedPublish ? publishBlockerMessage(missing) : "";
  const submit = async () => {
    if (saving) return;
    setSaveError("");
    if (missing.length > 0) {
      setTriedPublish(true);
      return;
    }
    setSaving(true);
    const saved = await addEvent({
      id: crypto.randomUUID(),
      title: f.title,
      description: f.description,
      place: f.place,
      date: f.date,
      allDay: f.allDay,
      time: f.allDay ? undefined : f.time,
      endTime: f.allDay || !f.endTime ? undefined : f.endTime,
      repeat: f.repeat === "none" ? undefined : f.repeat,
      category: f.category,
      gold: f.gold,
      image: f.image,
      lat: pos[0],
      lng: pos[1],
      own: true,
    });
    setSaving(false);
    if (!saved.ok) {
      setSaveError(saved.error);
      return;
    }
    onClose();
  };
  return (
    <Sheet title="Event hinzufügen" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Ort gewählt · {dist} km von dir entfernt</p>
        <Field label="Titel"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} /></Field>
        <Field label="Ort"><input className={inputCls} value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} maxLength={60} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Kategorie">
            <div className="mt-1 flex items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-white"><CategoryIcon category={f.category} className="h-5 w-5" /></span>
              <select className="border bg-muted min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </Field>
        </div>
        <label className="glass flex items-center gap-3 rounded-2xl px-3 py-2 text-sm">
          <input type="checkbox" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} className="h-4 w-4 accent-primary" />
          Ganztägig
        </label>
        {!f.allDay && (
          <div className="space-y-3">
            <TimeMenu label="Beginn" value={f.time} onChange={(time) => setF({ ...f, time })} />
            <TimeMenu label="Ende" value={f.endTime} optional onChange={(endTime) => setF({ ...f, endTime })} />
          </div>
        )}
        {!hasWhen && <p className="text-xs text-muted-foreground">Bitte eine Uhrzeit angeben oder als ganztägig markieren.</p>}
        <Field label="Wiederholung">
          <select className={inputCls} value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value as Repeat })}>
            {REPEAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <p className="text-xs text-muted-foreground">{repeatDescription({ date: f.date, repeat: f.repeat })}</p>
        {photo ? <ImageCrop file={photo} onChange={(image) => setF((current) => ({ ...current, image }))} onReplace={setPhoto} /> : (
          <label className="glass press flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><ImagePlus className="h-5 w-5" /> Bild hinzufügen, optional</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setPhoto(file); }} />
          </label>
        )}
        <Field label="Beschreibung" optional><textarea rows={3} className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} /></Field>
        <Button variant="ghost" type="button" onClick={() => setF({ ...f, gold: !f.gold })}
          className={`flex h-auto w-full items-center gap-3 whitespace-normal rounded-2xl p-3 text-left ${f.gold ? "bg-gradient-gold text-gold-foreground" : "glass"}`}>
          <Crown className="h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Goldener Pin – {GOLD_PIN_PRICE_EUR} €</p>
            <p className="text-xs opacity-80">Größer, leuchtend & ganz oben in der Liste</p>
          </div>
          <span className="text-sm font-bold">{f.gold ? "✓" : ""}</span>
        </Button>
        <Button variant="ghost" type="button" onClick={() => void submit()} disabled={saving} className="bg-gradient-primary h-auto w-full rounded-full py-3 font-medium text-primary-foreground">
          {saving ? "Speichert…" : f.gold ? `Veröffentlichen & ${GOLD_PIN_PRICE_EUR} € zahlen` : "Veröffentlichen"}
        </Button>
        {missingMessage && <p role="alert" className="text-xs text-destructive">{missingMessage}</p>}
        {saveError && <p role="alert" className="text-xs text-destructive">{saveError}</p>}
      </div>
    </Sheet>
  );
}

function AuthSheet({ onClose, initialMode, note }: { onClose: () => void; initialMode: "login" | "register"; note: string }) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const submit = async () => {
    setMessage("");
    const result = mode === "login" ? await signIn(email, password) : await signUp(email, password, username);
    if (!result.ok) {
      setFailed(true);
      setMessage(result.error);
      return;
    }
    if ("pending" in result && result.pending) {
      setFailed(false);
      setMessage("Konto angelegt. Bestätige die E-Mail, falls Supabase das verlangt, und melde dich dann an.");
      return;
    }
    onClose();
  };
  return (
    <Sheet onClose={onClose} title={mode === "login" ? "Anmelden" : "Registrieren"} footer={<Button variant="ghost" onClick={() => void submit()} className="bg-gradient-primary mt-4 h-auto w-full rounded-full py-3 font-medium text-primary-foreground">{mode === "login" ? "Anmelden" : "Konto erstellen"}</Button>}>
      {note && <p className="mb-3 text-sm text-muted-foreground">{note}</p>}
      <div className="flex gap-2">
        <Button variant={mode === "login" ? "default" : "secondary"} onClick={() => setMode("login")}>Anmelden</Button>
        <Button variant={mode === "register" ? "default" : "secondary"} onClick={() => setMode("register")}>Registrieren</Button>
      </div>
      <Field label="E-Mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" /></Field>
      {mode === "register" && <div className="mt-3"><Field label="Nutzername"><input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} maxLength={40} autoComplete="username" /></Field></div>}
      <div className="mt-3"><PasswordField value={password} onChange={setPassword} autoComplete={mode === "login" ? "current-password" : "new-password"} /></div>
      {message && <p role="alert" className={`mt-3 text-sm ${failed ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>}
    </Sheet>
  );
}

function FriendsView({ center, onSelect, onAuth }: { center: [number, number]; onSelect: (event: EventItem) => void; onAuth: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [profileName, setProfileName] = useState(store.profile.name);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestFailed, setRequestFailed] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [pendingFriend, setPendingFriend] = useState<{ id: string; name: string } | null>(null);
  const shownFriend = useRef(pendingFriend);
  if (pendingFriend) shownFriend.current = pendingFriend;
  useEffect(() => { setProfileName(store.profile.name); }, [store.profile.name]);
  const friendToRemove = pendingFriend ?? shownFriend.current;
  const today = localDate(new Date());
  const all = store.userEvents;
  if (!store.user) {
    return (
      <div className="grid h-full place-items-center px-6 pb-44 pt-36 text-center">
        <div className="glass max-w-sm rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Melde dich an</h2>
          <p className="mt-2 text-sm text-muted-foreground">Favoriten, Freunde und eigene Events gehören zu deinem Konto.</p>
          <Button variant="ghost" onClick={onAuth} className="bg-gradient-primary mt-4 h-auto w-full rounded-full py-3 font-medium text-primary-foreground">Anmelden</Button>
        </div>
      </div>
    );
  }
  const title = (id: string) => all.find((e) => e.id === id)?.title;
  const friendsFor = (id: string) => store.friends.filter((f) => f.favorites.includes(id));
  const favoriteEvents = store.favorites
    .map((id) => all.find((event) => event.id === id))
    .filter((event): event is EventItem => !!event)
    .map((event) => ({ ...event, dist: distanceKm({ lat: center[0], lng: center[1] }, event) }))
    .sort((a, b) => Number(!!b.gold) - Number(!!a.gold) || nextOccurrence(a, today).localeCompare(nextOccurrence(b, today)) || (a.time ?? "").localeCompare(b.time ?? ""));
  return (
    <div className="h-full overflow-y-auto px-3 pb-44 pt-36">
      <div className="mx-auto max-w-xl space-y-3">
        <div className="glass flex items-center gap-4 rounded-2xl p-4">
          <label className="press relative grid h-16 w-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-gradient-primary text-primary-foreground">
            {store.profile.avatar ? <img src={store.profile.avatar} alt="Profilbild" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6" />}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setProfile({ avatar: await fileToDataUrl(file, 300) }); }} />
          </label>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Mein Profil</p>
            <input value={profileName} onChange={(e) => setProfileName(e.target.value)} onBlur={() => { if (profileName.trim() && profileName.trim() !== store.profile.name) void setProfile({ name: profileName }); }} maxLength={40}
              className="w-full bg-transparent text-lg font-semibold outline-none" />
            <p className="text-xs text-muted-foreground">Tippe aufs Bild, um ein Profilbild zu wählen</p>
            <button type="button" onClick={() => void signOut()} className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline">Abmelden</button>
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <button type="button" aria-expanded={favoritesOpen} onClick={() => setFavoritesOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 text-left">
            <h3 className="font-semibold">Meine Favoriten</h3>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${favoritesOpen ? "rotate-180" : ""}`} />
          </button>
          {!favoritesOpen && <p className="mt-1 text-sm text-muted-foreground">{favoriteEvents.length ? `${favoriteEvents.length} Favoriten` : "Noch keine"}</p>}
          {favoritesOpen && favoriteEvents.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Noch keine</p>}
        </div>
        {favoritesOpen && favoriteEvents.map((e) => (
          <div key={e.id} role="button" tabIndex={0} onKeyDown={(ev) => { if (ev.target === ev.currentTarget && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); onSelect(e); } }} onClick={() => onSelect(e)}
            className={`glass block w-full rounded-2xl p-4 text-left ${e.gold ? "ring-2 ring-gold" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              {e.image && <img src={e.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {e.gold && <Crown className="h-4 w-4 shrink-0 text-gold" />}
                  <h3 className="truncate font-semibold">{e.title}</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{formatEventWhen(e, today)} · {e.place} · {Math.round(e.dist)} km</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"><CategoryIcon category={e.category} className="h-3.5 w-3.5 text-primary" /> {e.category}</span>
                {friendsFor(e.id).length > 0 && <p className="mt-2 text-xs text-primary">♥ {friendsFor(e.id).map((f) => f.name).join(", ")}</p>}
              </div>
              <FavButton id={e.id} active={store.favorites.includes(e.id)} />
            </div>
          </div>
        ))}
        <div className="glass rounded-2xl p-4">
          <button type="button" aria-expanded={requestsOpen} onClick={() => setRequestsOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 text-left">
            <h3 className="font-semibold">Freundesanfragen</h3>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">{store.friendRequests.length > 0 ? store.friendRequests.length : ""}<ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${requestsOpen ? "rotate-180" : ""}`} /></span>
          </button>
          {!requestsOpen && <p className="mt-1 text-sm text-muted-foreground">{store.friendRequests.length ? `${store.friendRequests.length} offen` : "Keine offenen Anfragen"}</p>}
          {requestsOpen && store.friendRequests.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Keine offenen Anfragen</p>}
          {requestsOpen && store.friendRequests.map((request) => (
            <div key={request.id} className="mt-3 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate font-medium">{request.fromUsername}</p>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" type="button" onClick={() => void acceptFriendRequest(request.id)} className="bg-gradient-primary h-9 rounded-full px-3 text-sm font-medium text-primary-foreground">Annehmen</Button>
                <Button variant="ghost" type="button" onClick={() => void declineFriendRequest(request.id)} className="glass h-9 rounded-full px-3 text-sm">Ablehnen</Button>
              </div>
            </div>
          ))}
        </div>
        <form className="glass flex flex-col gap-2 rounded-2xl p-2" onSubmit={(e) => { e.preventDefault(); const username = name.trim(); if (!username) return; void requestFriend(username).then((result) => { setRequestFailed(!result.ok); setRequestMessage(result.ok ? "Anfrage gesendet. Der Freund erscheint erst nach dem Annehmen." : result.error); if (result.ok) setName(""); }); }}>
          <div className="flex gap-2">
            <input placeholder="Freund hinzufügen…" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nutzername" className="min-w-0 flex-1 bg-transparent px-3 outline-none" maxLength={40} />
            <Button variant="ghost" className="bg-gradient-primary rounded-full px-4 py-2 text-sm font-medium text-primary-foreground">Hinzufügen</Button>
          </div>
          {requestMessage && <p role="alert" className={`px-3 pb-1 text-xs ${requestFailed ? "text-destructive" : "text-muted-foreground"}`}>{requestMessage}</p>}
        </form>
        {pinnedFriendsFirst(store.friends).map((f) => (
          <div key={f.id} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="bg-gradient-primary grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold text-primary-foreground">{f.name[0]?.toUpperCase()}</div>
                <div className="min-w-0"><h3 className="truncate font-semibold">{f.name}</h3>{f.pinned && <p className="text-xs text-primary">Bester Freund</p>}</div>
              </div>
              <div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={f.pinned ? `${f.name} lösen` : `${f.name} als besten Freund anpinnen`} title={f.pinned ? "Lösen" : "Bester Freund"} aria-pressed={!!f.pinned} onClick={() => togglePinFriend(f.id)} className={f.pinned ? "text-primary" : "text-muted-foreground"}><Pin className={f.pinned ? "fill-current" : ""} /></Button><Button size="icon" variant="ghost" aria-label={`${f.name} entfernen`} onClick={() => setPendingFriend({ id: f.id, name: f.name })}><Trash2 /></Button></div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">♥ {f.favorites.map(title).filter(Boolean).join(", ") || "Noch keine Favoriten"}</p>
          </div>
        ))}
      </div>
      <AlertDialog open={pendingFriend !== null} onOpenChange={(open) => { if (!open) setPendingFriend(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bist du dir sicher?</AlertDialogTitle>
            <AlertDialogDescription>{friendToRemove ? `${friendToRemove.name} wird aus deinen Freunden entfernt.` : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (friendToRemove) removeFriend(friendToRemove.id); }}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const TABS = [["map", MapIcon, "Karte"], ["list", List, "Liste"], ["friends", Users, "Freunde"]] as const;

function RadiusControl({ radius, setRadius }: { radius: number; setRadius: (radius: number) => void }) {
  return <label className="block text-sm font-medium leading-none"><span className="flex justify-between gap-2"><span>Umkreis</span><span className="text-primary">{isAllGermany(radius) ? "Ganz Deutschland" : `${radius} km`}</span></span><input aria-label="Radius" type="range" min={5} max={RADIUS_MAX_KM} step={5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="mt-1 block h-3 w-full accent-primary" /></label>;
}

function LiquidNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const ref = useRef<HTMLElement>(null);
  const gesture = useRef<{ start: number; moved: boolean; pointer: number } | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<number | null>(null);
  const idx = TABS.findIndex(([k]) => k === tab);
  const pos = (x: number) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? Math.max(0, Math.min(1, (x - r.left) / r.width)) : 0;
  };
  const left = drag !== null ? `calc(${Math.min(66.667, Math.max(0, drag * 100 - 16.667))}% + 4px)` : `calc(${idx * 33.333}% + 4px)`;
  return (
    <nav aria-label="Hauptnavigation" ref={ref} className="glass liquid-sheen relative mx-auto grid max-w-xl touch-none select-none grid-cols-3 rounded-full p-1"
      onPointerDown={(e) => { if (e.button !== 0) return; suppressClick.current = false; gesture.current = { start: e.clientX, moved: false, pointer: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const g = gesture.current; if (!g || g.pointer !== e.pointerId) return; if (Math.abs(e.clientX - g.start) > 6) g.moved = true; if (g.moved) setDrag(pos(e.clientX)); }}
      onPointerUp={(e) => { const g = gesture.current; if (!g) return; const target = TABS[navigationIndex(pos(e.clientX))]; if (target) setTab(target[0]); suppressClick.current = g.moved; gesture.current = null; setDrag(null); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => { gesture.current = null; setDrag(null); }}>
      <div className={`liquid-indicator ${drag !== null ? "dragging" : ""}`} style={{ left, width: "calc(33.333% - 8px)" }} />
      {TABS.map(([k, Icon, label]) => (
        <Button variant="ghost" key={k} aria-current={tab === k ? "page" : undefined} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setTab(k); }}
          className={`relative z-10 h-11 rounded-full transition-colors duration-300 ${tab === k ? "text-primary" : "text-foreground"}`}>
          <Icon /> {label}
        </Button>
      ))}
    </nav>
  );
}
