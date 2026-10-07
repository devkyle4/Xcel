import { PageContainer } from '../components/PageContainer';
import { ButtonLink } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <PageContainer title="Page not found" intro="We could not find the page you were looking for.">
      <ButtonLink to="/">Go to the homepage</ButtonLink>
    </PageContainer>
  );
}
