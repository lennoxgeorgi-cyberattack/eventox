import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, AttributionControl, useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";
import { CATEGORY_ICON_SVG } from "@/icons/category-icons";
import { type EventItem } from "@/lib/events";

const pin = (e: EventItem) =>
  L.divIcon({
    className: "",
    html: `<div class="eventox-pin-wrap"><div class="eventox-pin ${e.gold ? "eventox-pin-gold" : ""}"></div><span class="eventox-pin-icon">${CATEGORY_ICON_SVG[e.category]}</span></div>`,
    iconSize: e.gold ? [42, 42] : [32, 32],
    iconAnchor: e.gold ? [21, 42] : [16, 32],
  });

const me = L.divIcon({ className: "", html: `<div class="eventox-me"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });

function Recenter({ center, allGermany, active, returnRequest, onLocationOutside }: { center: [number, number]; allGermany: boolean; active: boolean; returnRequest: number; onLocationOutside: (outside: boolean) => void }) {
  const map = useMap();
  useEffect(() => void (allGermany ? map.flyTo([51.16, 10.45], 6) : map.flyTo(center, 9)), [center[0], center[1], allGermany]);
  useEffect(() => { if (active) { map.invalidateSize(); onLocationOutside(!map.getBounds().contains(center)); } }, [active, map, center, onLocationOutside]);
  useEffect(() => {
    if (returnRequest > 0) map.flyTo(center, 11, { duration: 0.8 });
  }, [returnRequest]);
  useMapEvents({ moveend: () => onLocationOutside(!map.getBounds().contains(center)) });
  return null;
}

function Picker({ onPick }: { onPick?: ((lat: number, lng: number) => void) | undefined }) {
  useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapView({
  center, radiusKm, allGermany, events, onSelect, onPick, active, returnRequest, onLocationOutside,
}: {
  allGermany: boolean;
  center: [number, number];
  radiusKm: number;
  events: EventItem[];
  onSelect: (e: EventItem) => void;
  onPick?: ((lat: number, lng: number) => void) | undefined;
  active: boolean;
  returnRequest: number;
  onLocationOutside: (outside: boolean) => void;
}) {
  return (
    <MapContainer center={center} zoom={9} zoomControl={false} attributionControl={false} className="h-full w-full">
      <AttributionControl prefix={false} />
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Recenter center={center} allGermany={allGermany} active={active} returnRequest={returnRequest} onLocationOutside={onLocationOutside} />
      <Picker onPick={onPick} />
      {!allGermany && <Circle center={center} radius={radiusKm * 1000} interactive={false} pathOptions={{ className: "eventox-radius" }} />}
      <Marker position={center} icon={me} interactive={false} />
      {[...events].sort((a, b) => Number(!!a.gold) - Number(!!b.gold)).map((e) => (
        <Marker key={e.id} position={[e.lat, e.lng]} icon={pin(e)} zIndexOffset={e.gold ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(e) }}>
        </Marker>
      ))}
    </MapContainer>
  );
}
