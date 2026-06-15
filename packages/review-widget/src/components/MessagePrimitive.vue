<script setup lang="ts">
import type { IntakeField, UiPlan } from "@loanslam/contracts";

import IntakeForm from "./IntakeForm.vue";

// Renders the engine's UI primitive for a single turn, inline under the
// assistant message it belongs to. Keeping it in its own component gives the
// discriminated union on `ui.primitive` a definite type to narrow against.

// ── Intake form: held back as a fallback only ──────────────────────────────
// The engine is being tuned to collect handoff details conversationally (it
// extracts `collectedFacts` from free-text replies and only re-asks for what is
// still missing). Its own intake copy is already a conversational ask, e.g.
// "To pass this to the team, I need your full name, date of birth and address.
// Let's start with your full name." — so the customer can just answer in the
// composer and the engine picks the facts up.
//
// A rendered form is a fine *fallback* for when that conversational path stalls,
// but as of now the contract has NO signal distinguishing "primary" from
// "fallback": `intake_form` carries only { primitive, message, fields }. The
// engine emits it whenever a handoff needs fields, not when NLP collection has
// failed. Until the core grows an explicit fallback condition (e.g. "asked N
// times and still missing" or a flag on the primitive), we suppress the form and
// let the message drive collection.
//
// To re-enable: flip this to read the real fallback signal once it exists in the
// contract, instead of the constant `false`. The IntakeForm component and its
// wiring are left intact so that is a one-line change.
const SHOW_INTAKE_FORM = false as boolean;

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
  intakeSubmit: [values: Partial<Record<IntakeField, string>>];
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

    <!-- Reserved as a fallback — see SHOW_INTAKE_FORM above. While suppressed,
         hasRenderableContent() keeps this whole block from rendering and the
         engine's conversational ask in the bubble drives collection instead. -->
    <IntakeForm
      v-else-if="ui.primitive === 'intake_form' && SHOW_INTAKE_FORM"
      :key="ui.fields.join(',')"
      :fields="ui.fields"
      @submit="emit('intakeSubmit', $event)"
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
