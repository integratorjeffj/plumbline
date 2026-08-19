/**
 * Publish the static export to the path GitHub Pages serves.
 *
 * next build writes to web/out/. Pages serves this repo from /docs, so the
 * built site is copied to docs/ and committed. Done in Node rather than a
 * shell one-liner so it behaves the same in PowerShell, Git Bash, and CI.
 *
 * docs/ is entirely generated. Nothing in it is hand-edited, which is the
 * point: the previous arrangement had a hand-written docs/index.html beside
 * the build output, and it silently drifted out of date against its own
 * source copy.
 */
import { existsSync, rmSync, cpSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
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
const target = join(repoRoot, 'docs');

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

// Pages would otherwise run the output through Jekyll, which drops _next/.
writeFileSync(join(target, '.nojekyll'), '');

// The app lived at /console for its first two releases. Anything already
// linking there -- the README, a bookmark, a shared URL -- should land in the
// app rather than on a 404.
const legacy = join(target, 'console');
mkdirSync(legacy, { recursive: true });
writeFileSync(
  join(legacy, 'index.html'),
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<title>Plumbline</title>' +
    '<meta http-equiv="refresh" content="0; url=/plumbline/">' +
    '<link rel="canonical" href="/plumbline/">' +
    '</head><body>' +
    '<p>The console moved to <a href="/plumbline/">/plumbline/</a>.</p>' +
    '</body></html>\n'
);

const routes = readdirSync(target, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name);

console.log(`  published  ->  docs/  (with .nojekyll and a /console redirect)`);
console.log(`  routes: / , ${routes.map((r) => `/${r}`).join(' , ')}`);
