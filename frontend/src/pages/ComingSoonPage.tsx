import { PageContainer } from '../components/PageContainer';
import { InfoPanel } from '../components/ui/InfoPanel';

/** Placeholder for pages built in later milestones. */
export function ComingSoonPage({ title, intro }: { title: string; intro: string }) {
  return (
    <PageContainer title={title} intro={intro}>
      <InfoPanel>This page is being built and will be available soon.</InfoPanel>
    </PageContainer>
  );
}
