import { EmptyState } from '@/components/EmptyState';
import { SectionHead } from '@/components/Bits';
import { PROJECT_IDS } from '@/lib/projects';

export default function ProgramSettingsPage() {
  return (
    <>
      <SectionHead eyebrow="Program" title="Settings">
        Defaults that would apply to every package unless a package overrides them.
      </SectionHead>
      <EmptyState
        icon="settings"
        title="Settings are deliberately package-scoped"
        body="Scope importance and adjustment amounts are estimator judgment calls, and they are not the same judgment on a medical fit-out as on a parking structure. Making them global would push a reviewer toward accepting a default that does not fit the package in front of them. Program-level defaults would need an override model before they earn their place here."
        actionLabel="Open scope and weighting for the first package"
        actionHref={`/p/${PROJECT_IDS[0]}/settings/`}
      />
    </>
  );
}
