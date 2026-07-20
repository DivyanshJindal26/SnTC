/**
 * Legacy URL map.
 *
 * The old site was six .html files at the root, and those paths are indexed
 * and linked externally. GitHub Pages cannot issue a 301 — there is no server
 * config — so each old path gets a real emitted document carrying a canonical
 * link plus a meta refresh. See src/pages/_legacy/.
 *
 * /index.html needs no entry: pages/index.astro already builds to the root.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  'SnTC_core.html': '/team/',
  'utkarsh.html': '/events/utkarsh-2024/',
  'projects.html': '/projects/',
  'events.html': '/events/',
  'achievements.html': '/achievements/',
};

/** The document served at a legacy path. */
export const redirectHtml = (to: string, origin: string) => {
  const target = new URL(to, origin).href;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved — SnTC, IIT Mandi</title>
<link rel="canonical" href="${target}">
<meta name="robots" content="noindex, follow">
<meta http-equiv="refresh" content="0; url=${to}">
<style>
  body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;
       place-items:center;background:#f5f7fa;color:#121821;padding:1.5rem}
  main{text-align:center;max-width:32rem}
  h1{font-size:1.35rem;color:#163a7d;margin:0 0 .5rem}
  p{margin:0 0 1rem;color:#55606f}
  a{color:#163a7d}
</style>
</head>
<body>
<main>
  <h1>This page has moved</h1>
  <p>The SnTC site was rebuilt and this address has a new home.</p>
  <p><a href="${to}">Continue to the new page</a></p>
</main>
</body>
</html>
`;
};
