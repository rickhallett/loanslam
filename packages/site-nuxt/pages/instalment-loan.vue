<template>
  <div>
    <div class="page-head">
      <div class="ripples"></div>
      <div class="container" style="position: relative">
        <p class="crumb" v-html="instalmentLoanCopy.head.crumbHtml" />
        <h1>{{ instalmentLoanCopy.head.title }}</h1>
        <p>{{ instalmentLoanCopy.head.body }}</p>
      </div>
    </div>

    <div class="container section">
      <div class="grid grid--2">
        <div
          v-for="card in instalmentLoanCopy.cards"
          :key="card.title"
          class="card reveal"
        >
          <h3>{{ card.title }}</h3>
          <p>{{ card.body }}</p>
        </div>
      </div>

      <section class="apply-band reveal">
        <div class="ripples"></div>
        <div class="band-inner">
          <h2>{{ instalmentLoanCopy.applyBand.title }}</h2>
          <ol class="steps">
            <li
              v-for="(step, i) in instalmentLoanCopy.applyBand.steps"
              :key="i"
            >
              <span class="step-num">{{ i + 1 }}</span>
              <p>{{ step }}</p>
            </li>
          </ol>
          <a
            class="btn btn--apply"
            :href="instalmentLoanCopy.applyBand.cta.href"
          >
            {{ instalmentLoanCopy.applyBand.cta.label }}
          </a>
        </div>
      </section>

      <h2>{{ instalmentLoanCopy.faqTitle }}</h2>
      <FaqList :items="items" />
      <p v-html="instalmentLoanCopy.faqLinkHtml" />

      <div
        class="notice"
        style="margin-top: 2.5rem"
        v-html="instalmentLoanCopy.noticeHtml"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import instalmentQa from "../data/instalment-qa.json";
import { page } from "../lib/content";
import { instalmentLoanCopy } from "../lib/site-copy";
import { rewriteLinks } from "../lib/siteRoutePolicy";

const record = page("instalment-loan");
const items = instalmentQa.map((item) => ({
  ...item,
  a: rewriteLinks(item.a),
}));

useHead({
  title: record.seo_title ?? record.title,
  meta: record.seo_description
    ? [{ name: "description", content: record.seo_description }]
    : [],
});
</script>

<style scoped>
.apply-band {
  position: relative;
  background: var(--ink-900);
  color: var(--on-dark);
  border-radius: var(--radius-lg);
  padding: clamp(1.8rem, 4.5vw, 3.2rem);
  margin-block: 2.6rem 3rem;
  overflow: hidden;
}

.band-inner {
  position: relative;
}

.apply-band h2 {
  color: #fff;
  font-size: clamp(1.6rem, 3vw, 2.3rem);
}

.steps {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.6rem;
  padding: 0;
  margin: 1.8rem 0 2rem;
}

.steps p {
  font-size: 0.95rem;
  margin: 0;
}

.step-num {
  display: inline-grid;
  place-items: center;
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 50%;
  background: var(--amber-400);
  color: var(--ink-950);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.2rem;
  margin-bottom: 0.7rem;
}

h2 {
  margin-top: 1rem;
}

@media (max-width: 720px) {
  .steps {
    grid-template-columns: 1fr;
  }
}
</style>
