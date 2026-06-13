<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { FormConfig, IntakeField } from '@loanslam/contracts';

const props = defineProps<{
  form: FormConfig;
  loading: boolean;
}>();

const emit = defineEmits<{ (e: 'submit', values: Record<string, string>): void }>();

// Field values held in in-memory reactive state only — never browser storage
// (brief §16). Seeded empty for every field the backend asked for.
const values = reactive<Record<string, string>>(
  Object.fromEntries(props.form.fields.map((f) => [f.name, ''])),
);
const errors = ref<Record<string, string>>({});

// Client-side required check is UX-only; the backend re-validates and is the
// source of truth. We never make a business decision here.
function validate(): boolean {
  const next: Record<string, string> = {};
  for (const field of props.form.fields) {
    if (field.required && (values[field.name] ?? '').trim().length === 0) {
      next[field.name] = `${field.label} is required.`;
    }
  }
  errors.value = next;
  return Object.keys(next).length === 0;
}

function onSubmit(): void {
  if (props.loading) return;
  if (!validate()) return;
  const snapshot: Record<string, string> = {};
  for (const field of props.form.fields) {
    snapshot[field.name] = (values[field.name] ?? '').trim();
  }
  // Do NOT clear here. On success the backend moves the conversation to
  // handoff_pending, this form unmounts (v-if), and its in-memory values are
  // discarded — satisfying "clear after submit" (brief §16) without browser
  // storage. On a backend rejection the form stays mounted so the customer
  // keeps their typed details and can correct them, rather than losing them.
  emit('submit', snapshot);
}

function inputType(field: IntakeField): string {
  return field.type === 'textarea' ? 'text' : field.type;
}
</script>

<template>
  <form class="intake" @submit.prevent="onSubmit">
    <h3 class="intake__title">{{ form.title }}</h3>
    <p class="intake__description">{{ form.description }}</p>

    <p class="intake__safety-note" role="note">
      We never ask for bank or card details here.
    </p>

    <div v-for="field in form.fields" :key="field.name" class="intake__field">
      <label :for="`intake-${field.name}`" class="intake__label">
        {{ field.label }}<span v-if="field.required" aria-hidden="true"> *</span>
      </label>

      <textarea
        v-if="field.type === 'textarea'"
        :id="`intake-${field.name}`"
        v-model="values[field.name]"
        class="intake__control"
        rows="3"
        :placeholder="field.placeholder"
        :required="field.required"
        :disabled="loading"
      />
      <input
        v-else
        :id="`intake-${field.name}`"
        v-model="values[field.name]"
        class="intake__control"
        :type="inputType(field)"
        :placeholder="field.placeholder"
        :required="field.required"
        :disabled="loading"
      />

      <p v-if="errors[field.name]" class="intake__error">{{ errors[field.name] }}</p>
    </div>

    <button type="submit" class="intake__submit" :disabled="loading">
      {{ form.submitLabel }}
    </button>
  </form>
</template>
