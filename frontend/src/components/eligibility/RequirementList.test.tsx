import { evaluateEligibility, indexCatalogue } from '@xcel/shared';
import { render, screen, within } from '@testing-library/react';
import { bundle } from '../../test/fixtures';
import { RequirementList } from './RequirementList';

const rule = (id: string, subject: string) => ({
  kind: 'rule' as const,
  id,
  ruleType: 'subject_grade',
  params: { subjectCodes: [subject], minGrade: 'C6' },
});

const anyOf = {
  kind: 'group' as const,
  id: 'g',
  operator: 'any' as const,
  children: [rule('physics', 'PHYSICS'), rule('biology', 'BIOLOGY')],
};

function renderFor(results: Record<string, string>) {
  const result = evaluateEligibility(anyOf, results, bundle.catalogue);
  render(
    <RequirementList
      root={result.root!}
      catalogue={indexCatalogue(bundle.catalogue)}
      showOutcomes
    />,
  );
}

describe('RequirementList', () => {
  it('shows an unmet option neutrally once another option is met', () => {
    renderFor({ BIOLOGY: 'A1' });
    const physics = screen.getByText('Physics: C6 or better').closest('div.rounded-md')!;
    expect(
      within(physics as HTMLElement).getByText('Not met (another option is)'),
    ).toBeInTheDocument();
    expect(physics).not.toHaveClass('border-red-300');
  });

  it('marks every option as not met, in red, when none is met', () => {
    renderFor({});
    for (const name of ['Physics: C6 or better', 'Biology: C6 or better']) {
      const row = screen.getByText(name).closest('div.rounded-md')!;
      expect(within(row as HTMLElement).getByText('Not met')).toBeInTheDocument();
      expect(row).toHaveClass('border-red-300');
    }
  });
});
