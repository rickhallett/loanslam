<template>
  <div>
    <div class="page-head">
      <div class="ripples"></div>
      <div class="container" style="position: relative">
        <p class="crumb" v-html="faqPageCopy.head.crumbHtml" />
        <h1>{{ faqPageCopy.head.title }}</h1>
        <p>{{ faqPageCopy.head.body }}</p>
      </div>
    </div>

    <div class="container section faq-grid">
      <div>
        <h2 class="group-title">
          <span>{{ applicationGroup.number }}</span
          >{{ applicationGroup.title }}
        </h2>
        <FaqList :items="application" />

        <h2 class="group-title spaced">
          <span>{{ existingGroup.number }}</span
          >{{ existingGroup.title }}
        </h2>
        <FaqList :items="existing" />
      </div>

      <aside class="side-cta">
        <img src="/duck.png" alt="" width="64" height="72" loading="lazy" />
        <p class="side-title">{{ faqPageCopy.sideCta.title }}</p>
        <p>{{ faqPageCopy.sideCta.body }}</p>
        <a class="btn btn--teal" :href="faqPageCopy.sideCta.cta.href">{{
          faqPageCopy.sideCta.cta.label
        }}</a>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import faqQa from "../data/faq-qa.json";
import { page } from "../lib/content";
import { faqPageCopy } from "../lib/site-copy";
import { rewriteLinks } from "../lib/sitePolicy";

const faq = page("faq");

const [applicationGroup, existingGroup] = faqPageCopy.groups;
if (!applicationGroup || !existingGroup) {
  throw new Error("faq page copy requires two question groups");
}

// Source order on the live site: 9 application questions, then 3 existing-customer ones.
const items = faqQa.map((item) => ({ ...item, a: rewriteLinks(item.a) }));
const application = items.slice(0, 9);
const existing = items.slice(9);

useHead({
  title: faq.seo_title ?? faq.title,
  meta: faq.seo_description
    ? [{ name: "description", content: faq.seo_description }]
    : [],
});
</script>

<style scoped>
.faq-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: clamp(2rem, 6vw, 5rem);
  align-items: start;
}

.group-title {
  display: flex;
  align-items: baseline;
  gap: 0.9rem;
  font-size: clamp(1.5rem, 2.6vw, 2rem);
  margin-bottom: 1.4rem;
}

.group-title span {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--amber-500);
  letter-spacing: 0.06em;
}

.spaced {
  margin-top: 3.2rem;
}

.side-cta {
  position: sticky;
  top: 96px;
  background: var(--ink-900);
  border-radius: var(--radius);
  padding: 1.7rem;
  color: var(--on-dark);
}

.side-title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.25rem;
  color: #fff;
  margin: 0.5rem 0 0.4rem;
}

.side-cta .btn {
  width: 100%;
}

@media (max-width: 880px) {
  .faq-grid {
    grid-template-columns: 1fr;
  }

  .side-cta {
    position: static;
  }
}
</style>
