import { screen } from '@testing-library/react';
import { catalogueRoutes, page, scholarshipSummaries } from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderRoute } from '../test/render';

// Accessible names must read naturally: visible text and screen-reader-only
// text are separate words ("Next page", not "Nextpage").
describe('accessible names', () => {
  it('keeps a space between visible and screen-reader-only text', async () => {
    mockApi({ 'GET /api/scholarships': page(scholarshipSummaries, 45) });
    renderRoute('/scholarships');
    expect(await screen.findByRole('button', { name: 'Next page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xcel – home' })).toBeInTheDocument();
  });

  it('names elective rows and their controls fully', async () => {
    mockApi(catalogueRoutes);
    renderRoute('/check-eligibility');
    expect(
      await screen.findByRole('combobox', { name: 'Grade for elective subject 1' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove elective subject 1' })).toBeInTheDocument();
  });
});
