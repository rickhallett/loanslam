<template>
  <div>
    <div class="page-head apply-head">
      <div class="ripples"></div>
      <div class="container apply-head-grid">
        <div>
          <p class="crumb" v-html="applyCopy.head.crumbHtml" />
          <h1>{{ applyCopy.title }}</h1>
          <p>{{ applyCopy.head.body }}</p>
        </div>
        <ul class="apply-signals" aria-label="Application trust signals">
          <li v-for="signal in applyCopy.head.signals" :key="signal">{{ signal }}</li>
        </ul>
      </div>
    </div>

    <ApplicationJourney />
  </div>
</template>

<script setup lang="ts">
import ApplicationJourney from '../components/ApplicationJourney.vue';
import { applyCopy } from '../lib/site-copy';

useHead({
  title: applyCopy.title,
  meta: [{ name: 'description', content: applyCopy.description }],
});
</script>

<style scoped>
  .apply-head-grid {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
    gap: clamp(1.5rem, 5vw, 4rem);
    align-items: end;
  }

  .apply-signals {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }

  .apply-signals li {
    position: relative;
    padding-left: 1.85rem;
    color: #fff;
    font-weight: 800;
  }

  .apply-signals li::before {
    content: '✓';
    position: absolute;
    left: 0;
    top: 0.05rem;
    display: grid;
    place-items: center;
    width: 1.3rem;
    height: 1.3rem;
    border-radius: 50%;
    background: var(--amber-400);
    color: var(--ink-950);
    font-size: 0.75rem;
  }

  @media (max-width: 760px) {
    .apply-head-grid {
      grid-template-columns: 1fr;
      align-items: start;
    }
  }
</style>
