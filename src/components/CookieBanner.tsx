export const COOKIE_CONSENT_KEY = "eventox-cookie-consent";

type CookieChoice = "all" | "essential";

export function CookieBanner({ onDecide }: { onDecide: (choice: CookieChoice) => void }) {
  const choose = (choice: CookieChoice) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice);
    onDecide(choice);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1100] p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-zinc-100 shadow-2xl sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-sm leading-snug text-zinc-300">
          Wir speichern nur, was die Seite braucht. Mit „Alle akzeptieren“ dürfen zusätzliche Cookies genutzt werden. Details stehen in der Datenschutzerklärung.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("essential")}
            className="rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/10"
          >
            Nur essenzielle
          </button>
          <button
            type="button"
            onClick={() => choose("all")}
            className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-white"
          >
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
