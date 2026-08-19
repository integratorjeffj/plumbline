/**
 * Static export configuration.
 *
 * The console ships as plain HTML/CSS/JS so it can live on GitHub Pages beside
 * the Python project rather than needing a server. Everything the UI does --
 * review decisions, scope weighting, live re-leveling -- runs client-side from
 * the pipeline output exported by scripts/export_demo_data.py.
 *
 * basePath matters: this is a GitHub *project* page (no custom domain), so
 * Pages serves everything under /plumbline/. The app owns that path outright.
 *
 * It used to sit at /plumbline/console, behind a hand-written landing page at
 * the root. That arrangement put a static brochure in front of the working
 * product and hid the product behind one link, and it meant two copies of the
 * landing page to keep in sync -- which promptly drifted, with the served copy
 * going stale while the edited one was never published at all. The app is the
 * demo now, and the brochure's content lives inside it at /how-it-works.
 */
const basePath = '/plumbline';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  // GitHub Pages resolves /review/ to /review/index.html but not bare /review.
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
