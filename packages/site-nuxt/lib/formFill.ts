// Propose-and-confirm form fill (dc3-002, D046): applies model-proposed
// values to the rendered application form via native input/change events so
// Vue's v-model updates — the shared Astro-source component stays untouched.
// Called only from an explicit user click in the chat widget.

export function applyFormFill(values: Record<string, string>): string[] {
  const applied: string[] = [];
  for (const [name, value] of Object.entries(values)) {
    const element = document.querySelector(`section.application [name="${CSS.escape(name)}"]`);
    if (element instanceof HTMLSelectElement) {
      element.value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      applied.push(name);
    } else if (element instanceof HTMLInputElement) {
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      applied.push(name);
    }
  }
  return applied;
}
