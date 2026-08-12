/**
 * Turn a hand-authored project seed into the full PipelineData shape the
 * console consumes, by running it through the same leveling and findings
 * engine (lib/leveling.ts, lib/findings.ts) the browser calls at runtime.
 *
 * Falcon Medical's data is Python-derived, independently verified against a
 * second implementation (see lib/leveling.ts's verifyAgainstPipeline). These
 * additional demo projects have no such second implementation to check
 * against -- deriving vendors/findings/summary here, through the real engine
 * rather than by hand, means parity holds by construction instead of by
 * arithmetic that could quietly drift from what the console actually
 * computes.
 *
 *     npx tsx scripts/build-demo-projects.ts
 *
 * Run on demand, like scripts/export_demo_data.py -- not part of dev/build.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildComparison, defaultSettings } from '../lib/leveling';
import { computeFindings } from '../lib/findings';
import type { PipelineData, ScopeItem, ScopeStatus, Submission } from '../lib/types';

interface ScopeTaxonomyEntry {
  key: string;
  label: string;
  in_package_scope: boolean;
}

interface ProjectSeed {
  project: PipelineData['project'];
  scope_taxonomy: ScopeTaxonomyEntry[];
  required_scope: PipelineData['required_scope'];
  adjustment_rules: PipelineData['adjustment_rules'];
  submissions: Submission[];
  revisions: PipelineData['revisions'];
  superseded: PipelineData['superseded'];
}

function buildScopeItems(taxonomy: ScopeTaxonomyEntry[], submissions: Submission[]): ScopeItem[] {
  const active = submissions.filter((s) => !s.superseded);
  return taxonomy.map((entry) => ({
    key: entry.key,
    label: entry.label,
    in_package_scope: entry.in_package_scope,
    statuses: Object.fromEntries(
      active.map((s) => [s.vendor_id, (s.scope_assertions[entry.key] ?? 'NotFound') as ScopeStatus])
    ),
  }));
}

function build(seed: ProjectSeed): PipelineData {
  const scope_items = buildScopeItems(seed.scope_taxonomy, seed.submissions);

  // A draft with vendors/findings/summary left empty is enough to run the
  // real engine -- neither buildComparison nor computeFindings reads those
  // three fields, only what's already assembled below.
  const draft: PipelineData = {
    project: seed.project,
    submissions: seed.submissions,
    vendors: [],
    scope_items,
    required_scope: seed.required_scope,
    adjustment_rules: seed.adjustment_rules,
    findings: [],
    revisions: seed.revisions,
    superseded: seed.superseded,
    summary: {
      leveling_changes_the_answer: false,
      lowest_submitted: '',
      lowest_submitted_total: 0,
      lowest_adjusted: '',
      lowest_adjusted_total: 0,
      active_bidders: 0,
      documents_processed: 0,
      high_severity_findings: 0,
    },
  };

  const settings = defaultSettings(draft);
  const vendors = buildComparison(draft, settings);
  const findings = computeFindings(draft, vendors, settings);

  const bySubmitted = vendors.find((v) => v.submitted_rank === 1)!;
  const byAdjusted = vendors.find((v) => v.adjusted_rank === 1)!;

  return {
    ...draft,
    vendors,
    findings,
    summary: {
      leveling_changes_the_answer: bySubmitted.vendor_id !== byAdjusted.vendor_id,
      lowest_submitted: bySubmitted.vendor_name,
      lowest_submitted_total: bySubmitted.submitted_total,
      lowest_adjusted: byAdjusted.vendor_name,
      lowest_adjusted_total: byAdjusted.adjusted_total,
      active_bidders: vendors.length,
      documents_processed: seed.submissions.length,
      high_severity_findings: findings.filter((f) => f.severity === 'HIGH').length,
    },
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const repoRoot = process.env.PLUMBLINE_REPO_ROOT
  ? resolve(process.env.PLUMBLINE_REPO_ROOT)
  : join(webRoot, '..');

const seedsDir = join(webRoot, 'data', 'seeds');
const outDir = join(repoRoot, 'demo', 'projects');
mkdirSync(outDir, { recursive: true });

const seedFiles = readdirSync(seedsDir).filter((f) => f.endsWith('.seed.json'));
if (seedFiles.length === 0) {
  console.error(`\n  No seed files found in ${seedsDir}\n`);
  process.exit(1);
}

for (const file of seedFiles) {
  const seed = JSON.parse(readFileSync(join(seedsDir, file), 'utf-8')) as ProjectSeed;
  const slug = file.replace(/\.seed\.json$/, '');
  const outPath = join(outDir, `${slug}.json`);

  if (existsSync(outPath)) {
    // Falcon Medical is Python-derived and must never be clobbered by this script.
    console.error(`\n  Refusing to overwrite ${outPath} -- remove it first if regenerating.\n`);
    process.exit(1);
  }

  const data = build(seed);
  writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(
    `  built ${slug}: ${data.vendors.length} vendors, ${data.findings.length} findings  ->  demo/projects/${slug}.json`
  );
}
