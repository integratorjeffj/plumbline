/**
 * Copy the exported pipeline output into the Next app.
 *
 * The console must never hand-maintain its own copy of the numbers. This runs
 * before every dev and build so the UI is always rendering what
 * scripts/export_demo_data.py actually produced; if the Python output changes
 * shape, the TypeScript build breaks here rather than silently showing stale
 * figures to a reviewer.
 */
import { existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');

// The repo lives on Google Drive, whose sync daemon holds locks on files while
// npm is writing them, so installs and builds are run from a local scratch copy
// instead. PLUMBLINE_REPO_ROOT points that copy back at the real repo.
const repoRoot = process.env.PLUMBLINE_REPO_ROOT
  ? resolve(process.env.PLUMBLINE_REPO_ROOT)
  : join(webRoot, '..');

const source = join(repoRoot, 'demo', 'data.json');
const targetDir = join(webRoot, 'data');
const target = join(targetDir, 'pipeline.json');

if (!existsSync(source)) {
  console.error(
    `\n  Missing ${source}\n` +
      `  Run this first, from the repo root:\n\n` +
      `      python scripts/export_demo_data.py\n`
  );
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);

const kb = (statSync(target).size / 1024).toFixed(1);
console.log(`  synced pipeline data  ${kb} kB  ->  web/data/pipeline.json`);
