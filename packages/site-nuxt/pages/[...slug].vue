<template>
  <div>
    <div class="page-head">
      <div class="ripples"></div>
      <div class="container" style="position: relative">
        <p class="crumb"><a href="/">Home</a> / {{ record.title }}</p>
        <h1>{{ record.title }}</h1>
      </div>
    </div>

    <div class="container section body-grid">
      <article class="prose" v-html="html" />
      <aside class="side">
        <nav v-if="showToc" class="toc" :aria-label="newsCopy.genericPage.tocLabel">
          <p class="side-label">{{ newsCopy.genericPage.tocLabel }}</p>
          <ul>
            <li v-for="item in toc" :key="item.id">
              <a :href="`#${item.id}`">{{ item.label }}</a>
            </li>
          </ul>
        </nav>
        <div class="side-cta">
          <img src="/duck.png" alt="" width="58" height="65" loading="lazy" />
          <p class="side-cta-title">{{ newsCopy.genericPage.sideCta.title }}</p>
          <p class="small">{{ newsCopy.genericPage.sideCta.body }}</p>
          <a class="btn btn--apply" :href="newsCopy.genericPage.sideCta.cta.href">
            {{ newsCopy.genericPage.sideCta.cta.label }}
          </a>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  normalizeContentHeadings,
  pages,
  pathFromLink,
  rewriteLinks,
  withToc,
} from '../lib/content';
import { newsCopy } from '../lib/site-copy';

// Pages with bespoke templates; everything else renders through this prose
// layout (mirrors the Astro [...slug] getStaticPaths filter).
const BESPOKE = new Set(['home', 'faq', 'contact', 'instalment-loan']);

const route = useRoute();
const requested = `/${[route.params.slug].flat().filter(Boolean).join('/')}/`;

const record = pages.find(
  (p) => !BESPOKE.has(p.slug) && pathFromLink(p.link) === requested,
);

if (!record) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true });
}

const { html, toc } = withToc(rewriteLinks(normalizeContentHeadings(record.html)));
const showToc = toc.length >= 2;

useHead({
  title: record.seo_title ?? record.title,
  meta: record.seo_description
    ? [{ name: 'description', content: record.seo_description }]
    : [],
});
</script>

<style scoped>
  .body-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: clamp(2rem, 6vw, 5rem);
    align-items: start;
  }

  .side {
    position: sticky;
    top: 96px;
    display: flex;
    flex-direction: column;
    gap: 1.4rem;
  }

  .side-label {
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.7rem;
  }

  .toc ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border-left: 2px solid var(--line-cool);
  }

  .toc a {
    display: block;
    padding: 0.4rem 0 0.4rem 1rem;
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--body);
    text-decoration: none;
    border-left: 2px solid transparent;
    margin-left: -2px;
  }

  .toc a:hover {
    color: var(--teal-500);
    border-left-color: var(--amber-400);
  }

  .side-cta {
    background: var(--ink-900);
    border-radius: var(--radius);
    padding: 1.5rem;
    color: var(--on-dark);
  }

  .side-cta img {
    margin-bottom: 0.4rem;
  }

  .side-cta-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.15rem;
    color: #fff;
    margin-bottom: 0.4rem;
  }

  .side-cta .small {
    color: var(--on-dark-muted);
  }

  .side-cta .btn {
    width: 100%;
  }

  @media (max-width: 880px) {
    .body-grid {
      grid-template-columns: 1fr;
    }

    .side {
      position: static;
    }

    .toc {
      display: none;
    }
  }
</style>
