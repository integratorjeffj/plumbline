/**
 * Diff the browser award scoring against the Python baseline, per factor.
 *
 * The console shows a parity badge when the two disagree, but a badge cannot
 * say WHICH factor drifted. This prints that, so a mismatch is a five-second
 * diagnosis instead of a hunt.
 *
 *     npx tsx web/scripts/check-award-parity.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAward } from '../lib/award';
import { buildComparison, defaultSettings } from '../lib/leveling';
import type { PipelineData } from '../lib/types';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const repoRoot = process.env.PLUMBLINE_REPO_ROOT
  ? resolve(process.env.PLUMBLINE_REPO_ROOT)
  : join(webRoot, '..');

const projectsDir = join(repoRoot, 'demo', 'projects');
let failures = 0;

for (const file of readdirSync(projectsDir).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(projectsDir, file), 'utf-8')) as PipelineData;
  const slug = file.replace(/\.json$/, '');

  if (!data.award) {
    console.log(`  ${slug}: no award baseline, skipped`);
    continue;
  }

  const vendors = buildComparison(data, defaultSettings(data));
  const computed = buildAward(data, vendors, data.award.weights);

  if (!computed) {
    console.error(`  ${slug}: browser engine produced no award`);
    failures += 1;
    continue;
  }

  const rows: string[] = [];
  for (const expected of data.award.scores) {
    const actual = computed.scores.find((s) => s.vendor_id === expected.vendor_id);
    if (!actual) {
      rows.push(`      ${expected.vendor_name}: missing from browser output`);
      continue;
    }

    if (Math.abs(actual.total_score - expected.total_score) > 0.01) {
      rows.push(
        `      ${expected.vendor_name}: total python=${expected.total_score} browser=${actual.total_score}`
      );
      for (const pf of expected.factors) {
        const bf = actual.factors.find((f) => f.factor === pf.factor);
        if (!bf || Math.abs(bf.score - pf.score) > 0.01) {
          rows.push(
            `        ${pf.factor}: python=${pf.score} browser=${bf ? bf.score : 'missing'}`
          );
          if (bf) {
            rows.push(`          python basis: ${pf.basis}`);
            rows.push(`          browser basis: ${bf.basis}`);
          }
        }
      }
    }
  }

  if (rows.length) {
    failures += 1;
    console.error(`  ${slug}: PARITY FAILURE`);
    rows.forEach((r) => console.error(r));
  } else {
    console.log(`  ${slug}: parity ok (${data.award.scores.length} vendors)`);
  }
}

if (failures > 0) {
  console.error(`\n  ${failures} package(s) failed award parity\n`);
  process.exit(1);
}
console.log('\n  award parity holds across every package\n');
