import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ITEM_H = 36;
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function Wheel({ items, value, label, onSelect }: { items: string[]; value: string; label: string; onSelect: (value: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ignore = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const drag = useRef<{ y: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const index = Math.max(0, items.indexOf(value));
    const top = index * ITEM_H;
    if (Math.abs(el.scrollTop - top) <= 1) return;
    ignore.current = true;
    el.scrollTop = top;
    const frame = requestAnimationFrame(() => { ignore.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [items, value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const settle = () => {
    const el = ref.current;
    if (!el || ignore.current || drag.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const index = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      const next = items[index];
      if (next && next !== value) onSelect(next);
    }, 80);
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="listbox"
      aria-label={label}
      onScroll={settle}
      onKeyDown={(event) => {
        const index = Math.max(0, items.indexOf(value));
        if (event.key === "ArrowDown") { event.preventDefault(); onSelect(items[Math.min(items.length - 1, index + 1)] ?? value); }
        if (event.key === "ArrowUp") { event.preventDefault(); onSelect(items[Math.max(0, index - 1)] ?? value); }
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse" || !ref.current) return;
        drag.current = { y: event.clientY, top: ref.current.scrollTop };
        try { ref.current.setPointerCapture(event.pointerId); } catch { /* capture is optional */ }
      }}
      onPointerMove={(event) => {
        if (!drag.current || !ref.current) return;
        ref.current.scrollTop = drag.current.top - (event.clientY - drag.current.y);
      }}
      onPointerUp={() => { drag.current = null; settle(); }}
      onPointerCancel={() => { drag.current = null; settle(); }}
      className="h-[108px] touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="h-9" />
      {items.map((item) => (
        <div key={item} role="option" aria-selected={item === value} className={`flex h-9 snap-center items-center justify-center text-lg tabular-nums ${item === value ? "font-semibold" : "text-muted-foreground"}`}>
          {item}
        </div>
      ))}
      <div className="h-9" />
    </div>
  );
}

export function TimeMenu({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hour = "", minute = ""] = value.split(":");
  const shownHour = HOURS.includes(hour) ? hour : "12";
  const minuteChoices = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES;
  const shownMinute = minuteChoices.includes(minute) ? minute : "00";
  const choose = (nextHour: string, nextMinute: string) => onChange(`${nextHour}:${nextMinute}`);

  return (
    <div>
      <span className="block text-sm font-medium">{label}</span>
      <button type="button" aria-expanded={open} aria-label={label} onClick={() => setOpen((current) => !current)}
        className="border bg-muted mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm">
        <span className={value ? "tabular-nums" : "text-muted-foreground"}>{value ? `${value} Uhr` : "Uhrzeit wählen"}</span>
        <span aria-hidden className="text-muted-foreground">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="mt-2 rounded-2xl bg-secondary/70 p-2">
          <p className="px-1 pb-1 text-center text-xs text-muted-foreground">Ziehen zum Drehen</p>
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-9 -translate-y-1/2 rounded-xl bg-background/80" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-base font-semibold">:</span>
            <div className="relative z-10 grid grid-cols-2">
              <Wheel items={HOURS} value={shownHour} label={`${label} Stunde`} onSelect={(next) => choose(next, shownMinute)} />
              <Wheel items={minuteChoices} value={shownMinute} label={`${label} Minute`} onSelect={(next) => choose(shownHour, next)} />
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-6 bg-gradient-to-b from-secondary to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-6 bg-gradient-to-t from-secondary to-transparent" />
          </div>
          <div className="grid grid-cols-2 pt-1 text-center text-xs text-muted-foreground"><span>Stunde</span><span>Minute</span></div>
          {optional && value && <button type="button" className="mt-1 px-1 text-xs text-muted-foreground underline" onClick={() => { onChange(""); setOpen(false); }}>Keine Endzeit</button>}
        </div>
      )}
    </div>
  );
}
