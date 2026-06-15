<script setup lang="ts">
import { reactive } from "vue";

import type { IntakeField } from "@loanslam/contracts";

const props = defineProps<{ fields: IntakeField[] }>();
const emit = defineEmits<{
  submit: [values: Record<IntakeField, string>];
  cancel: [];
}>();

const LABELS: Record<IntakeField, string> = {
  fullName: "Full name",
  dateOfBirth: "Date of birth",
  postcode: "Postcode",
  email: "Email",
  phone: "Phone number",
};

const INPUT_TYPES: Partial<Record<IntakeField, string>> = {
  dateOfBirth: "date",
  email: "email",
  phone: "tel",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s]{7,15}$/;

const values = reactive<Record<string, string>>({});
const errors = reactive<Record<string, string>>({});
props.fields.forEach((field) => {
  values[field] = "";
  errors[field] = "";
});

function validateField(field: IntakeField, value: string): string {
  if (!value) {
    return `${LABELS[field]} is required.`;
  }
  if (field === "email" && !EMAIL_RE.test(value)) {
    return "Enter a valid email address.";
  }
  if (field === "phone" && !PHONE_RE.test(value.replace(/\s/g, ""))) {
    return "Enter a valid phone number.";
  }
  return "";
}

function submit(): void {
  const trimmed = {} as Record<IntakeField, string>;
  let valid = true;

  props.fields.forEach((field) => {
    const value = values[field]?.trim() ?? "";
    trimmed[field] = value;
    const error = validateField(field, value);
    errors[field] = error;
    if (error) {
      valid = false;
    }
  });

  if (!valid) {
    return;
  }

  emit("submit", trimmed);
}

function cancel(): void {
  emit("cancel");
}
</script>

<template>
  <form class="identity-form" @submit.prevent="submit">
    <label
      v-for="field in fields"
      :key="field"
      class="identity-field"
      :class="{
        'identity-field--half': field === 'dateOfBirth' || field === 'postcode',
      }"
    >
      <span class="identity-label">{{ LABELS[field] }}</span>
      <input v-model="values[field]" :type="INPUT_TYPES[field] ?? 'text'" />
      <span v-if="errors[field]" class="identity-error" role="alert">
        {{ errors[field] }}
      </span>
    </label>
    <div class="identity-actions">
      <button class="identity-submit" type="submit">Share with the team</button>
      <button class="identity-cancel" type="button" @click="cancel">
        Cancel
      </button>
    </div>
  </form>
</template>

<style scoped>
/* Two-column grid: most fields span the full width; the short ones
   (date of birth, postcode) take one column each so they share a row. */
.identity-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px 10px;
  margin-top: 6px;
}
.identity-field {
  grid-column: span 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.identity-field--half {
  grid-column: span 1;
}
.identity-label {
  font-size: 0.74rem;
  font-weight: 600;
  color: #334155;
}
.identity-field input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 9px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
}
.identity-field input:focus {
  outline: 2px solid #0d9488;
  outline-offset: 1px;
  border-color: #0d9488;
}
.identity-error {
  font-size: 0.7rem;
  color: #b91c1c;
}
.identity-actions {
  grid-column: span 2;
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 2px;
}
.identity-submit {
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: #0d9488;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.identity-cancel {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  cursor: pointer;
}
</style>
