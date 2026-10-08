import {
  type CatalogueIndex,
  describeGroup,
  describeOutcome,
  describeRequirement,
  type GroupResult,
  type NodeOutcome,
  type NodeResult,
} from '@xcel/shared';
import { CircleCheck, CircleHelp, CircleMinus, CircleX } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

const OUTCOMES: Record<
  NodeOutcome,
  { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; icon: string }
> = {
  satisfied: { label: 'Met', Icon: CircleCheck, icon: 'text-green-700' },
  unsatisfied: { label: 'Not met', Icon: CircleX, icon: 'text-red-600' },
  needs_confirmation: { label: 'To confirm', Icon: CircleHelp, icon: 'text-blue-700' },
  unevaluable: { label: 'Not checked', Icon: CircleHelp, icon: 'text-blue-700' },
};

/** An option the student did not meet, in a group they meet through another option: not a failure. */
const UNUSED_OPTION = {
  label: 'Not met (another option is)',
  Icon: CircleMinus,
  icon: 'text-blue-700',
};

function OutcomeLabel({ outcome, unusedOption }: { outcome: NodeOutcome; unusedOption: boolean }) {
  const { label, Icon, icon } =
    unusedOption && outcome === 'unsatisfied' ? UNUSED_OPTION : OUTCOMES[outcome];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
      <Icon aria-hidden="true" className={`size-5 ${icon}`} />
      {label}
      <span className="sr-only">:</span>
    </span>
  );
}

function Node({
  node,
  catalogue,
  showOutcomes,
  unusedOption,
}: {
  node: NodeResult;
  catalogue: CatalogueIndex;
  showOutcomes: boolean;
  /** Inside an alternative the student does not need, because another option is met. */
  unusedOption: boolean;
}) {
  if (node.kind === 'group') {
    return (
      <div className="border-l-4 border-blue-100 pl-4">
        <Group
          group={node}
          catalogue={catalogue}
          showOutcomes={showOutcomes}
          unusedOption={unusedOption}
        />
      </div>
    );
  }
  // Red only marks a real shortfall, never an alternative the student does not need.
  const failed = showOutcomes && node.outcome === 'unsatisfied' && !unusedOption;
  return (
    <div
      className={`rounded-md border p-3 ${failed ? 'border-red-300 bg-white' : 'border-blue-100 bg-white'}`}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        {showOutcomes && <OutcomeLabel outcome={node.outcome} unusedOption={unusedOption} />}
        <span className="font-medium">{describeRequirement(node, catalogue)}</span>
      </div>
      {showOutcomes && <p className="mt-1 text-sm">{describeOutcome(node, catalogue)}</p>}
    </div>
  );
}

function Group({
  group,
  catalogue,
  showOutcomes,
  unusedOption,
}: {
  group: GroupResult;
  catalogue: CatalogueIndex;
  showOutcomes: boolean;
  unusedOption: boolean;
}) {
  // Once an "any" group is met, its unmet options are just alternatives the student does not need.
  const optionsUnused = unusedOption || (group.operator === 'any' && group.outcome === 'satisfied');
  return (
    <div className="space-y-2">
      <p className="font-semibold">
        {/* A labelled group (e.g. "Core subjects") reads "Core subjects: all of the following". */}
        {group.label
          ? `${group.label}: ${describeGroup(group).toLowerCase()}`
          : describeGroup(group)}
        {showOutcomes && group.operator !== 'all' && !group.problem && (
          <span className="font-normal">
            {' '}
            (you meet {group.satisfiedCount} of the {group.required} needed)
          </span>
        )}
      </p>
      {group.problem ? (
        <p>This part could not be checked automatically. Check the official requirements.</p>
      ) : (
        <ul className="space-y-2">
          {group.children.map((child) => (
            <li key={child.id}>
              <Node
                node={child}
                catalogue={catalogue}
                showOutcomes={showOutcomes}
                unusedOption={optionsUnused}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A programme's requirements in plain language, generated from the
 * structured rules. With `showOutcomes`, each requirement also shows whether
 * the student meets it, their grade and the required grade.
 */
export function RequirementList({
  root,
  catalogue,
  showOutcomes,
}: {
  root: GroupResult;
  catalogue: CatalogueIndex;
  showOutcomes: boolean;
}) {
  return (
    <Group group={root} catalogue={catalogue} showOutcomes={showOutcomes} unusedOption={false} />
  );
}
