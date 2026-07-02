<template>
  <div>
    <a class="skip-link" href="#main">{{ siteChrome.accessibility.skipLinkLabel }}</a>
    <SiteHeader />
    <main id="main">
      <NuxtPage />
    </main>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { siteChrome } from './lib/site-copy';
</script>
