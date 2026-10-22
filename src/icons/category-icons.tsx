import type { Category } from "@/lib/events";
import andere from "./categories/andere.svg?raw";
import essen from "./categories/essen.svg?raw";
import familie from "./categories/familie.svg?raw";
import fest from "./categories/fest.svg?raw";
import flohmarkt from "./categories/flohmarkt.svg?raw";
import kirmes from "./categories/kirmes.svg?raw";
import kinder from "./categories/kinder.svg?raw";
import kirche from "./categories/kirche.svg?raw";
import kultur from "./categories/kultur.svg?raw";
import markt from "./categories/markt.svg?raw";
import musik from "./categories/musik.svg?raw";
import natur from "./categories/natur.svg?raw";
import party from "./categories/party.svg?raw";
import sport from "./categories/sport.svg?raw";
import workshop from "./categories/workshop.svg?raw";

export const CATEGORY_ICON_SVG: Record<Category, string> = {
  Fest: fest,
  Kirmes: kirmes,
  Markt: markt,
  Flohmarkt: flohmarkt,
  Musik: musik,
  Sport: sport,
  Kultur: kultur,
  Kirche: kirche,
  Familie: familie,
  Kinder: kinder,
  Natur: natur,
  Essen: essen,
  Party: party,
  Workshop: workshop,
  Andere: andere,
};

export function CategoryIcon({ category, className = "h-4 w-4" }: { category: Category; className?: string }) {
  return <span className={`inline-block shrink-0 [&_svg]:h-full [&_svg]:w-full ${className}`} aria-hidden dangerouslySetInnerHTML={{ __html: CATEGORY_ICON_SVG[category] }} />;
}
