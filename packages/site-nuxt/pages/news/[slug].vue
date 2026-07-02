<template>
  <div>
    <div class="page-head">
      <div class="ripples"></div>
      <div class="container" style="position: relative">
        <p class="crumb">
          <a href="/news/">{{ newsCopy.article.backLabel }}</a> ·
          <time :datetime="post.date ?? undefined">{{ formatDate(post.date) }}</time> · {{ readMins }} {{ newsCopy.article.readTimeSuffix }}
        </p>
        <h1>{{ post.title }}</h1>
      </div>
    </div>

    <div class="container section body-grid">
      <article class="prose" v-html="articleHtml" />
      <aside class="side-cta">
        <img src="/duck.png" alt="" width="58" height="65" loading="lazy" />
        <p class="side-title">{{ newsCopy.article.sideCta.title }}</p>
        <p class="small">{{ newsCopy.article.sideCta.body }}</p>
        <a class="btn btn--apply" :href="newsCopy.article.sideCta.cta.href">
          {{ newsCopy.article.sideCta.cta.label }}
        </a>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate, posts, rewriteLinks, stripLeadingH1 } from '../../lib/content';
import { newsCopy } from '../../lib/site-copy';

const route = useRoute();
const post = posts.find((p) => p.slug === route.params.slug);

if (!post) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true });
}

const words = post.html.replace(/<[^>]+>/g, ' ').split(/\s+/).length;
const readMins = Math.max(1, Math.round(words / 220));
const articleHtml = rewriteLinks(stripLeadingH1(post.html));

useHead({
  title: post.seo_title ?? post.title,
  meta: post.seo_description
    ? [{ name: 'description', content: post.seo_description }]
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

  .side-cta {
    position: sticky;
    top: 96px;
    background: var(--ink-900);
    border-radius: var(--radius);
    padding: 1.5rem;
    color: var(--on-dark);
  }

  .side-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.15rem;
    color: #fff;
    margin: 0.4rem 0;
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

    .side-cta {
      position: static;
    }
  }
</style>
