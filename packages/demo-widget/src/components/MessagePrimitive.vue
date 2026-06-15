<script setup lang="ts">
import type { IntakeField, UiPlan } from "@loanslam/contracts";

import IntakeForm from "./IntakeForm.vue";

// Renders the engine's UI primitive for a single turn, inline under the
// assistant bubble it belongs to. Keeping it in its own component gives the
// discriminated union on `ui.primitive` a definite type to narrow against.
defineProps<{ ui: UiPlan | null }>();
const emit = defineEmits<{
  choose: [label: string];
  intakeSubmit: [values: Partial<Record<IntakeField, string>>];
}>();
</script>

<template>
  <div v-if="ui" class="ls-primitive">
    <div v-if="ui.primitive === 'choice_list'" class="ls-choices">
      <button
        v-for="choice in ui.choices"
        :key="choice.id"
        class="ls-chip"
        type="button"
        @click="emit('choose', choice.label)"
      >
        {{ choice.label }}
      </button>
    </div>

    <IntakeForm
      v-else-if="ui.primitive === 'intake_form'"
      :key="ui.fields.join(',')"
      :fields="ui.fields"
      @submit="emit('intakeSubmit', $event)"
    />

    <div
      v-else-if="
        (ui.primitive === 'message' || ui.primitive === 'safe_fallback') &&
        ui.links.length > 0
      "
      class="ls-links"
    >
      <a
        v-for="(link, index) in ui.links"
        :key="index"
        class="ls-link"
        :href="link.url ?? link.href ?? '#'"
        target="_blank"
        rel="noopener"
      >
        {{ link.label }}
      </a>
    </div>

    <div v-else-if="ui.primitive === 'handoff_confirmation'" class="ls-handoff">
      Our support team will take it from here.
      <template v-if="ui.reference">
        Your reference is <strong>{{ ui.reference }}</strong
        >.
      </template>
    </div>
  </div>
</template>
