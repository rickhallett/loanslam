// Thin form-state reader for the demo concierge (D045). Reads the rendered
// application journey DOM rather than component internals:
// ApplicationJourney.vue is shared source with the Astro site (a preserved
// human gate), so it stays untouched. Values are synthetic demo data; the
// content-free telemetry boundary is knowingly crossed on the concierge
// surface only.

export interface ApplicationFormSnapshot {
  step: string | null;
  fields: Record<string, string>;
  [key: string]: unknown;
}

export function snapshotApplicationForm(): ApplicationFormSnapshot | null {
  const root = document.querySelector("section.application");
  if (!root) return null;

  const step = root.querySelector(".progress-eyebrow")?.textContent?.trim() ?? null;
  const fields: Record<string, string> = {};
  for (const element of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    "input[name], select[name]",
  )) {
    fields[element.name] = element.value;
  }
  return { step, fields };
}
