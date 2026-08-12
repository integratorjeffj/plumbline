/**
 * Static export configuration.
 *
 * The console ships as plain HTML/CSS/JS so it can live on GitHub Pages beside
 * the Python project rather than needing a server. Everything the UI does --
 * review decisions, scope weighting, live re-leveling -- runs client-side from
 * the pipeline output exported by scripts/export_demo_data.py.
 *
 * basePath matters: this is a GitHub *project* page (no custom domain), so
 * Pages serves everything under /plumbline/. The console sits at /console
 * beneath that, so every asset and link needs both segments or it 404s.
 */
const basePath = '/plumbline/console';

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
