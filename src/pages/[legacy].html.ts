/**
 * Emits one document per legacy .html path, e.g. /SnTC_core.html.
 *
 * A route file named `[legacy].html.ts` produces `/<param>.html` — Astro
 * strips only the final `.ts`, so the `.html` stays in the built filename.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { LEGACY_REDIRECTS, redirectHtml } from '../lib/urls';
import { site } from '../data/site';

export const getStaticPaths: GetStaticPaths = () =>
  Object.entries(LEGACY_REDIRECTS).map(([from, to]) => ({
    // the param excludes the ".html" the filename already supplies
    params: { legacy: from.replace(/\.html$/, '') },
    props: { to },
  }));

export const GET: APIRoute = ({ props, site: astroSite }) => {
  const to = props.to as string;
  return new Response(redirectHtml(to, astroSite?.href ?? site.url), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
