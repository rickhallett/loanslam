import { conciergeEnabled, conciergeModel } from "../../utils/concierge";

// Content-free status for UI affordance gating and probes (D045): the kill
// switch must silence the concierge everywhere with one env var.
export default defineEventHandler(() => ({
  enabled: conciergeEnabled(),
  model: conciergeEnabled() ? conciergeModel() : null,
}));
