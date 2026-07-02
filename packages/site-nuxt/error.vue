<template>
  <div>
    <a class="skip-link" href="#main">{{ siteChrome.accessibility.skipLinkLabel }}</a>
    <SiteHeader />
    <main id="main">
      <div class="page-head">
        <div class="ripples"></div>
        <div class="container" style="position: relative">
          <p class="crumb" v-html="notFoundCopy.head.crumbHtml" />
          <h1>{{ notFoundCopy.head.title }}</h1>
          <p v-html="notFoundCopy.head.bodyHtml" />
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { notFoundCopy, siteChrome } from './lib/site-copy';

useHead({ title: notFoundCopy.title });
</script>
