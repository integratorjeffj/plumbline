import { ProjectStoreProvider } from '@/lib/store';
import { PROJECT_IDS } from '@/lib/projects';

/**
 * Pre-render one set of routes per known project id. This must be a server
 * component -- generateStaticParams is a build-time-only export -- so the
 * actual project data loading and state happen in the client ProjectStoreProvider
 * it wraps.
 */
export function generateStaticParams() {
  return PROJECT_IDS.map((projectId) => ({ projectId }));
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <ProjectStoreProvider key={projectId} projectId={projectId}>
      {children}
    </ProjectStoreProvider>
  );
}
