/**
 * Copy every exported project into the Next app.
 *
 * The console must never hand-maintain its own copy of the numbers. This runs
 * before every dev and build so the UI is always rendering what
 * demo/projects/*.json actually contains -- one file per bid package, some
 * produced by scripts/export_demo_data.py (Falcon Medical, via the real
 * Python pipeline), some by web/scripts/build-demo-projects.ts (hand-authored
 * seeds run through the same leveling/findings engine the console calls at
 * runtime). If a project's shape changes, the TypeScript build breaks in
 * web/lib/projects.ts rather than silently showing stale figures to a
 * reviewer.
 */
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
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

const sourceDir = join(repoRoot, 'demo', 'projects');
const targetDir = join(webRoot, 'data', 'projects');

if (!existsSync(sourceDir)) {
  console.error(
    `\n  Missing ${sourceDir}\n` +
      `  Run this first, from the repo root:\n\n` +
      `      python scripts/export_demo_data.py\n`
  );
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

const files = readdirSync(sourceDir).filter((f) => f.endsWith('.json'));
if (files.length === 0) {
  console.error(`\n  No project JSON files found in ${sourceDir}\n`);
  process.exit(1);
}

let totalKb = 0;
for (const file of files) {
  const source = join(sourceDir, file);
  copyFileSync(source, join(targetDir, file));
  totalKb += statSync(source).size / 1024;
}

console.log(
  `  synced ${files.length} project(s), ${totalKb.toFixed(1)} kB  ->  web/data/projects/`
);
