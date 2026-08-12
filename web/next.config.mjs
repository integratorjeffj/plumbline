/**
 * Static export configuration.
 *
 * The console ships as plain HTML/CSS/JS so it can live on GitHub Pages beside
 * the Python project rather than needing a server. Everything the UI does --
 * review decisions, scope weighting, live re-leveling -- runs client-side from
 * the pipeline output exported by scripts/export_demo_data.py.
 *
 * basePath matters: Pages serves this repo at /plumbline/, and the console sits
 * in the /console/ subfolder at the repo root, so the basePath is just /console.
 */
const basePath = '/console';

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
