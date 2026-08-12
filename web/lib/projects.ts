/**
 * The set of bid packages the console can open.
 *
 * Hand-maintained rather than a directory glob -- same rationale as the
 * hand-written types in ./types.ts: adding a project is one line here plus a
 * seed file, and the compiler fails loudly if a listed file's shape drifts,
 * instead of the directory route silently rendering a project that doesn't
 * actually import.
 *
 * Every project is bundled at build time (not fetched), so switching projects
 * never introduces a network round trip -- the leveling engine stays
 * zero-latency regardless of which package is open.
 */

import falconMedical from '@/data/projects/falcon-medical.json';
import harborviewMechanical from '@/data/projects/harborview-mechanical.json';
import westbrookElectrical from '@/data/projects/westbrook-electrical.json';
import type { PipelineData } from './types';

export const PROJECTS: Record<string, PipelineData> = {
  'falcon-medical': falconMedical as unknown as PipelineData,
  'harborview-mechanical': harborviewMechanical as unknown as PipelineData,
  'westbrook-electrical': westbrookElectrical as unknown as PipelineData,
};

export const PROJECT_IDS = Object.keys(PROJECTS);

export function getProject(id: string): PipelineData | undefined {
  return PROJECTS[id];
}
