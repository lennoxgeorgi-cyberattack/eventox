/**
 * Öffentliche Kalender, die der Grok-Bot auslesen darf.
 * Nur https-Adressen eintragen, die wir selbst festgelegt haben.
 * Der Bot akzeptiert keine beliebigen URLs aus einem Request.
 */
export type ImportSource = {
  id: string;
  name: string;
  url: string;
};

export const IMPORT_SOURCES: ImportSource[] = [
  // { id: "stadt-beispiel", name: "Stadt Beispiel", url: "https://www.beispielstadt.de/veranstaltungen" },
];
