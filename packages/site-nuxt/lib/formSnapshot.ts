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
    // A checkbox's .value is a constant (usually "on") whether or not it is
    // ticked, and every radio in a group reports its own .value, so the last
    // one in the DOM would win. Both need .checked, not .value.
    if (element.type === "checkbox") {
      fields[element.name] = (element as HTMLInputElement).checked ? "checked" : "unchecked";
    } else if (element.type === "radio") {
      if ((element as HTMLInputElement).checked) {
        fields[element.name] = element.value;
      } else if (!(element.name in fields)) {
        fields[element.name] = "";
      }
    } else {
      fields[element.name] = element.value;
    }
  }
  return { step, fields };
}
