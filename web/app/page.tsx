import { PROJECT_IDS, getProject } from '@/lib/projects';
import { ProjectCard } from '@/components/ProjectCard';
import { SectionHead } from '@/components/Bits';

export default function DirectoryPage() {
  return (
    <>
      <SectionHead eyebrow="Bid packages" title="Active projects">
        Select a package to open its review console. Every project below is entirely synthetic --
        no real bid data is represented anywhere in this demo.
      </SectionHead>

      <div className="grid grid-3">
        {PROJECT_IDS.map((id) => {
          const data = getProject(id)!;
          return (
            <ProjectCard
              key={id}
              id={id}
              name={data.project.project_name}
              packageLabel={`${data.project.bid_package_number} · ${data.project.bid_package_description}`}
              bidCount={data.summary.active_bidders}
              alertCount={data.summary.high_severity_findings}
            />
          );
        })}
      </div>
    </>
  );
}
