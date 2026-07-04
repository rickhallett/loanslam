// Form-state reader for the demo concierge (D045). The current step is read
// from the rendered DOM; the whole-journey memory (every completed step plus
// the computed loan offer) comes from the state hook ApplicationJourney.vue
// publishes on window (the Astro single-source gate was lifted by operator
// decision 2026-07-04). Values are synthetic demo data; the content-free
// telemetry boundary is knowingly crossed on the concierge surface only.

export interface ApplicationFormSnapshot {
  step: string | null;
  fields: Record<string, string>;
  journey: Record<string, unknown> | null;
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
  const journey =
    typeof window === "undefined"
      ? null
      : ((window as { __malJourneyState?: Record<string, unknown> }).__malJourneyState ?? null);

  return { step, fields, journey };
}
