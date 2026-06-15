<script setup lang="ts">
import { reactive } from "vue";

import type { IntakeField } from "@loanslam/contracts";

const props = defineProps<{ fields: IntakeField[] }>();
const emit = defineEmits<{
  submit: [values: Partial<Record<IntakeField, string>>];
}>();

const LABELS: Record<IntakeField, string> = {
  fullName: "Full name",
  dateOfBirth: "Date of birth",
  address: "Address",
  phone: "Phone number",
  email: "Email",
  situationSummary: "Brief summary",
};

const INPUT_TYPES: Partial<Record<IntakeField, string>> = {
  dateOfBirth: "date",
  phone: "tel",
  email: "email",
};

const values = reactive<Record<string, string>>({});
props.fields.forEach((field) => {
  values[field] = "";
});

function submit(): void {
  emit("submit", { ...values } as Partial<Record<IntakeField, string>>);
}
</script>

<template>
  <form class="identity-form" @submit.prevent="submit">
    <label v-for="field in fields" :key="field" class="identity-field">
      <span>{{ LABELS[field] }}</span>
      <textarea
        v-if="field === 'situationSummary'"
        v-model="values[field]"
        rows="2"
      ></textarea>
      <input
        v-else
        v-model="values[field]"
        :type="INPUT_TYPES[field] ?? 'text'"
      />
    </label>
    <button type="submit">Share with the team</button>
  </form>
</template>
