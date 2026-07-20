// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sntc.iitmandi.co.in',
  output: 'static',
  trailingSlash: 'always',
  build: {
    // emit /team/index.html so GitHub Pages serves /team/ without a redirect
    format: 'directory',
  },
  integrations: [
    sitemap({
      // legacy .html shims are noindex redirects — keep them out of the sitemap
      filter: (page) => !page.includes('.html'),
    }),
  ],
  image: {
    // posters and portraits only; nothing here needs remote images
    domains: [],
  },
  devToolbar: {
    enabled: false,
  },
});
