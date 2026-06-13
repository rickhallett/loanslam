<script setup lang="ts">
import type { HandoffIntakeForm, IntakeField } from '@loanslam/contracts';

const props = defineProps<{
  form: HandoffIntakeForm;
  values: Record<string, string>;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  submit: [];
  update: [name: string, value: string];
}>();

function inputMode(field: IntakeField): 'email' | 'tel' | undefined {
  if (field.inputType === 'email') {
    return 'email';
  }

  if (field.inputType === 'tel') {
    return 'tel';
  }

  return undefined;
}
</script>

<template>
  <form class="intake-form" data-testid="intake-form" @submit.prevent="emit('submit')">
    <h2>{{ props.form.title }}</h2>
    <label v-for="field in props.form.fields" :key="field.name" class="field">
      <span>{{ field.label }}</span>
      <textarea
        v-if="field.inputType === 'textarea'"
        :name="field.name"
        :required="field.required"
        :disabled="props.disabled"
        :value="props.values[field.name] ?? ''"
        rows="3"
        @input="emit('update', field.name, ($event.target as HTMLTextAreaElement).value)"
      />
      <input
        v-else
        :name="field.name"
        :type="field.inputType"
        :inputmode="inputMode(field)"
        :required="field.required"
        :disabled="props.disabled"
        :value="props.values[field.name] ?? ''"
        @input="emit('update', field.name, ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button class="primary-action" type="submit" :disabled="props.disabled">
      {{ props.form.submitLabel }}
    </button>
  </form>
</template>
