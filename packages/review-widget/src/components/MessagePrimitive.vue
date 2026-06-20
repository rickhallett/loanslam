<script setup lang="ts">
import type { IntakeField, UiPlan } from "@loanslam/contracts";

import IntakeForm from "./IntakeForm.vue";

// Renders the engine's UI primitive for a single turn, inline under the
// assistant message it belongs to. Keeping it in its own component gives the
// discriminated union on `ui.primitive` a definite type to narrow against.

// ── Intake form ────────────────────────────────────────────────────────────
// The structured form is the primary intake path: it submits exact field values
// to POST /demo/sessions/:ref/intake (no free-text extraction), which removes the
// extraction loop that the conversational path was prone to. The customer can
// still cancel back into the chat. Submit/cancel are handled by the parent.
const SHOW_INTAKE_FORM = true as boolean;

// True only when this primitive has something to draw. Without it, plain
// `message` turns (no links) and the suppressed `intake_form` would still render
// an empty `.primitive` box and leave a stray gap under the bubble.
function hasRenderableContent(plan: UiPlan): boolean {
  switch (plan.primitive) {
    case "choice_list":
      return plan.choices.length > 0;
    case "intake_form":
      return SHOW_INTAKE_FORM && plan.fields.length > 0;
    case "message":
    case "safe_fallback":
      return plan.links.length > 0;
    case "handoff_confirmation":
      return true;
    default:
      return false;
  }
}

defineProps<{ ui: UiPlan | null }>();
const emit = defineEmits<{
  choose: [label: string];
  intakeSubmit: [values: Record<IntakeField, string>];
  intakeCancel: [];
}>();
</script>

<template>
  <div v-if="ui && hasRenderableContent(ui)" class="primitive">
    <div v-if="ui.primitive === 'choice_list'" class="choices">
      <button
        v-for="choice in ui.choices"
        :key="choice.id"
        class="chip"
        type="button"
        @click="emit('choose', choice.label)"
      >
        {{ choice.label }}
      </button>
    </div>

    <IntakeForm
      v-else-if="ui.primitive === 'intake_form' && SHOW_INTAKE_FORM"
      :key="ui.fields.join(',')"
      :fields="ui.fields"
      @submit="emit('intakeSubmit', $event)"
      @cancel="emit('intakeCancel')"
    />

    <div
      v-else-if="
        (ui.primitive === 'message' || ui.primitive === 'safe_fallback') &&
        ui.links.length > 0
      "
      class="links"
    >
      <a
        v-for="(link, index) in ui.links"
        :key="index"
        class="link"
        :href="link.url ?? link.href ?? '#'"
        target="_blank"
        rel="noopener"
      >
        {{ link.label }}
      </a>
    </div>

    <div v-else-if="ui.primitive === 'handoff_confirmation'" class="handoff">
      Our support team will take it from here.
      <template v-if="ui.reference">
        Your reference is <strong>{{ ui.reference }}</strong
        >.
      </template>
    </div>
  </div>
</template>
