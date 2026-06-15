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
  <form class="ls-intake" @submit.prevent="submit">
    <label v-for="field in fields" :key="field" class="ls-intake__row">
      <span class="ls-intake__label">{{ LABELS[field] }}</span>
      <input
        v-model="values[field]"
        class="ls-intake__input"
        :type="INPUT_TYPES[field] ?? 'text'"
      />
      <span v-if="errors[field]" class="ls-intake__error" role="alert">
        {{ errors[field] }}
      </span>
    </label>
    <div class="ls-intake__actions">
      <button class="ls-send ls-intake__submit" type="submit">
        Share with the team
      </button>
      <button class="ls-intake__cancel" type="button" @click="cancel">
        Cancel
      </button>
    </div>
  </form>
</template>
