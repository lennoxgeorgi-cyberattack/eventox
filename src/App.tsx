import { useEffect, useState, type ReactNode } from "react";
import { COOKIE_CONSENT_KEY, CookieBanner } from "@/components/CookieBanner";

export function App({ children }: { children: ReactNode }) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_CONSENT_KEY)) setShowBanner(true);
  }, []);

  return (
    <>
      {children}
      {showBanner && <CookieBanner onDecide={() => setShowBanner(false)} />}
    </>
  );
}
