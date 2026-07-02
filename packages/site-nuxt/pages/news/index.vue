<template>
  <div>
    <div class="page-head">
      <div class="ripples"></div>
      <div class="container" style="position: relative">
        <p class="crumb" v-html="newsCopy.index.head.crumbHtml" />
        <h1>{{ newsCopy.index.head.title }}</h1>
        <p>{{ newsCopy.index.head.body }}</p>
      </div>
    </div>

    <div class="container section">
      <a class="feature reveal" :href="`/news/${featured.slug}/`">
        <div>
          <time class="small" :datetime="featured.date ?? undefined">{{ formatDate(featured.date) }}</time>
          <h2>{{ featured.title }}</h2>
          <p>{{ featured.seo_description }}</p>
          <span class="more">{{ newsCopy.index.featuredLabel }}</span>
        </div>
        <img src="/duck.png" alt="" width="120" height="135" loading="lazy" />
      </a>

      <div class="grid grid--3" style="margin-top: 2rem">
        <a
          v-for="post in rest"
          :key="post.slug"
          class="card news-card reveal"
          :href="`/news/${post.slug}/`"
        >
          <time class="small" :datetime="post.date ?? undefined">{{ formatDate(post.date) }}</time>
          <h3>{{ post.title }}</h3>
          <p>{{ post.seo_description }}</p>
          <span class="more">{{ newsCopy.index.cardLabel }}</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate, posts } from '../../lib/content';
import { newsCopy } from '../../lib/site-copy';

const [featured, ...rest] = posts;

useHead({
  title: newsCopy.index.title,
  meta: [{ name: 'description', content: newsCopy.index.description }],
});
</script>

<style scoped>
  .feature {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    text-decoration: none;
    background: var(--ink-900);
    border-radius: var(--radius-lg);
    padding: clamp(1.8rem, 4vw, 3rem);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }

  .feature:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
  }

  .feature time {
    color: var(--teal-300);
  }

  .feature h2 {
    color: #fff;
    margin: 0.4rem 0 0.6rem;
    font-size: clamp(1.6rem, 3vw, 2.4rem);
    max-width: 36rem;
  }

  .feature p {
    color: var(--on-dark);
    max-width: 36rem;
  }

  .feature img {
    flex: none;
  }

  .more {
    color: var(--amber-400);
    font-weight: 800;
  }

  .news-card {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .news-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
  }

  .news-card h3 {
    font-size: 1.12rem;
    margin-top: 0.4rem;
  }

  .news-card p {
    font-size: 0.92rem;
    color: var(--muted);
    flex: 1;
  }

  .news-card .more {
    color: var(--teal-500);
    font-size: 0.92rem;
  }

  @media (max-width: 720px) {
    .feature img {
      display: none;
    }
  }
</style>
