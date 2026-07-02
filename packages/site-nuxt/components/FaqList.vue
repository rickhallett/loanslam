<template>
  <div class="faq-list">
    <details v-for="item in items" :key="item.q" class="faq-item">
      <summary>{{ item.q }}</summary>
      <div class="faq-body" v-html="item.a" />
    </details>
  </div>
</template>

<script setup lang="ts">
defineProps<{ items: { q: string; a: string }[] }>();
</script>
