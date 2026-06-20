import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

export default defineConfig({
  site: 'https://loansbymal.co.uk',
  trailingSlash: 'ignore',
  integrations: [vue()],
});
