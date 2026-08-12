/**
 * Publish the static export to the path GitHub Pages serves.
 *
 * next build writes to web/out/. Pages serves the repo root, so the built site
 * is copied to /console at the repo root and committed. Done in Node rather
 * than a shell one-liner so it behaves the same in PowerShell, Git Bash, and CI.
 */
import { existsSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');

// See sync-data.mjs: builds run from a local scratch copy because the repo sits
// on Google Drive. This points the published output back at the real repo.
const repoRoot = process.env.PLUMBLINE_REPO_ROOT
  ? resolve(process.env.PLUMBLINE_REPO_ROOT)
  : join(webRoot, '..');

const source = join(webRoot, 'out');
const target = join(repoRoot, 'console');

if (!existsSync(source)) {
  console.error(`\n  No build output at ${source}. Did next build succeed?\n`);
  process.exit(1);
}

// Replace rather than merge: a stale route left behind from a previous build
// would still be served by Pages and would quietly contradict the current app.
if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
}
cpSync(source, target, { recursive: true });

const routes = readdirSync(target, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name);

console.log(`  published  ->  console/`);
console.log(`  routes: / , ${routes.map((r) => `/${r}`).join(' , ')}`);
