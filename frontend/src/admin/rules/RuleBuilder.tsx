import {
  type AcademicCatalogue,
  type CatalogueIndex,
  describeRequirement,
  evaluateEligibility,
  type GroupResult,
  MAX_REQUIREMENT_DEPTH,
  type NodeResult,
  type RequirementOperator,
  type RuleResult,
  type TreeIssue,
} from '@xcel/shared';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { inputClasses } from '../components/fields';
import { type Catalogue, RuleParamsEditor } from './RuleParamsEditor';
import { friendlyProblems, RULE_TYPE_OPTIONS, ruleTypeLabel } from './rule-types';
import {
  addChild,
  type EditorGroup,
  type EditorNode,
  type EditorRule,
  moveNode,
  newGroup,
  newRule,
  removeNode,
  setOperator,
  updateNode,
} from './tree';

const OPERATOR_LABELS: Record<RequirementOperator, string> = {
  all: 'All of the following',
  any: 'Any one of the following',
  at_least: 'Any N of the following',
};

/** Rule results by node id, evaluated with no results so each rule can be described. */
function describeAll(root: EditorGroup, catalogue: AcademicCatalogue) {
  const results = new Map<string, RuleResult>();
  const visit = (node: NodeResult) => {
    if (node.kind === 'rule') results.set(node.id, node);
    else node.children.forEach(visit);
  };
  const result = evaluateEligibility(root, {}, catalogue);
  if (result.root) visit(result.root as GroupResult);
  return results;
}

interface Context {
  catalogue: Catalogue;
  index: CatalogueIndex;
  descriptions: Map<string, RuleResult>;
  issues: Map<string, TreeIssue[]>;
  readOnly: boolean;
  expanded: Set<string>;
  toggle: (id: string, open?: boolean) => void;
  change: (root: EditorGroup) => void;
  root: EditorGroup;
}

/**
 * Edits a requirement tree: nested "all", "any one" and "any N" groups of
 * rules. Problems are shown next to the node they belong to, and each rule
 * is described in the same words students see.
 */
export function RuleBuilder({
  value,
  onChange,
  catalogue,
  academic,
  index,
  issues,
  readOnly = false,
}: {
  value: EditorGroup | null;
  onChange: (root: EditorGroup | null) => void;
  catalogue: Catalogue;
  academic: AcademicCatalogue;
  index: CatalogueIndex;
  issues: TreeIssue[];
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const descriptions = useMemo(
    () => (value ? describeAll(value, academic) : new Map<string, RuleResult>()),
    [value, academic],
  );
  const issuesByNode = useMemo(() => {
    const map = new Map<string, TreeIssue[]>();
    for (const issue of issues) {
      if (issue.nodeId) map.set(issue.nodeId, [...(map.get(issue.nodeId) ?? []), issue]);
    }
    return map;
  }, [issues]);

  if (!value) {
    return readOnly ? (
      <p>No requirements.</p>
    ) : (
      <div className="space-y-3">
        <p>No requirements yet. Start with a group, then add requirements to it.</p>
        <Button onClick={() => onChange(newGroup('all'))}>
          <Plus aria-hidden="true" className="size-5" /> Start requirements
        </Button>
      </div>
    );
  }

  const context: Context = {
    catalogue,
    index,
    descriptions,
    issues: issuesByNode,
    readOnly,
    expanded,
    toggle: (id, open) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (open ?? !next.has(id)) next.add(id);
        else next.delete(id);
        return next;
      }),
    change: onChange,
    root: value,
  };
  return <GroupEditor group={value} depth={1} context={context} position={null} />;
}

function NodeIssues({ issues, rule }: { issues?: TreeIssue[]; rule?: EditorRule }) {
  if (!issues?.length) return null;
  const messages = issues.flatMap((i) => (rule ? friendlyProblems(rule, i) : [i.message]));
  return (
    <ul className="space-y-0.5 text-sm font-semibold text-red-800">
      {messages.map((m) => (
        <li key={m} className="flex gap-1.5">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {m}
        </li>
      ))}
    </ul>
  );
}

/** Move up, move down and remove buttons for a node that is not the root. */
function NodeActions({
  node,
  name,
  position,
  context,
}: {
  node: EditorNode;
  name: string;
  position: { index: number; count: number } | null;
  context: Context;
}) {
  if (!position || context.readOnly) return null;
  const button = 'rounded-md p-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-40';
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        className={button}
        disabled={position.index === 0}
        onClick={() => context.change(moveNode(context.root, node.id, -1))}
      >
        <ArrowUp aria-hidden="true" className="size-5" />
        <span className="sr-only">Move {name} up</span>
      </button>
      <button
        type="button"
        className={button}
        disabled={position.index === position.count - 1}
        onClick={() => context.change(moveNode(context.root, node.id, 1))}
      >
        <ArrowDown aria-hidden="true" className="size-5" />
        <span className="sr-only">Move {name} down</span>
      </button>
      <button
        type="button"
        className={button}
        onClick={() => context.change(removeNode(context.root, node.id))}
      >
        <Trash2 aria-hidden="true" className="size-5" />
        <span className="sr-only">Remove {name}</span>
      </button>
    </span>
  );
}

function GroupEditor({
  group,
  depth,
  context,
  position,
}: {
  group: EditorGroup;
  depth: number;
  context: Context;
  position: { index: number; count: number } | null;
}) {
  const id = useId();
  const [adding, setAdding] = useState('');
  const update = (next: EditorGroup) =>
    context.change(updateNode(context.root, group.id, () => next));
  const heading =
    group.operator === 'at_least'
      ? `Any ${group.minCount ?? 'N'} of the following`
      : OPERATOR_LABELS[group.operator];
  const name = group.label ? `group “${group.label}”` : `group “${heading}”`;

  const add = (type: string) => {
    if (type === 'group') {
      context.change(addChild(context.root, group.id, newGroup('any')));
    } else {
      const option = RULE_TYPE_OPTIONS.find((o) => o.type === type);
      if (!option) return;
      const rule = newRule(option.type, structuredClone(option.params) as Record<string, unknown>);
      context.change(addChild(context.root, group.id, rule));
      context.toggle(rule.id, true);
    }
    setAdding('');
  };

  return (
    <section
      aria-label={name}
      className={`space-y-3 rounded-lg border-l-4 p-3 ${depth === 1 ? 'border-blue-700 bg-white' : 'border-blue-300 bg-off-white'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {context.readOnly ? (
          <p className="font-semibold">
            {heading}
            {group.label && <span className="font-normal"> — {group.label}</span>}
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={`${id}-op`} className="mb-1 block text-sm font-semibold">
                Students must meet
              </label>
              <select
                id={`${id}-op`}
                value={group.operator}
                onChange={(e) => update(setOperator(group, e.target.value as RequirementOperator))}
                className={inputClasses}
              >
                {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {group.operator === 'at_least' && (
              <div className="w-24">
                <label htmlFor={`${id}-n`} className="mb-1 block text-sm font-semibold">
                  N
                </label>
                <input
                  id={`${id}-n`}
                  type="number"
                  min={1}
                  max={Math.max(group.children.length, 1)}
                  value={group.minCount ?? ''}
                  onChange={(e) =>
                    update({ ...group, minCount: e.target.value ? Number(e.target.value) : null })
                  }
                  className={inputClasses}
                />
              </div>
            )}
            <div>
              <label htmlFor={`${id}-label`} className="mb-1 block text-sm font-semibold">
                Label <span className="font-normal">(optional)</span>
              </label>
              <input
                id={`${id}-label`}
                value={group.label ?? ''}
                maxLength={200}
                onChange={(e) => update({ ...group, label: e.target.value || null })}
                className={inputClasses}
              />
            </div>
          </div>
        )}
        <NodeActions node={group} name={name} position={position} context={context} />
      </div>
      <NodeIssues issues={context.issues.get(group.id)} />

      {group.children.length > 0 && (
        <ol className="space-y-3">
          {group.children.map((child, index) => (
            <li key={child.id}>
              {child.kind === 'group' ? (
                <GroupEditor
                  group={child}
                  depth={depth + 1}
                  context={context}
                  position={{ index, count: group.children.length }}
                />
              ) : (
                <RuleEditor
                  rule={child}
                  context={context}
                  position={{ index, count: group.children.length }}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {!context.readOnly && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={`${id}-add`} className="sr-only">
              Add to {name}
            </label>
            <select
              id={`${id}-add`}
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              className={inputClasses}
            >
              <option value="">Add a requirement…</option>
              {RULE_TYPE_OPTIONS.map((o) => (
                <option key={o.type} value={o.type}>
                  {o.label} ({o.hint})
                </option>
              ))}
              {depth < MAX_REQUIREMENT_DEPTH && (
                <option value="group">A group (for “any one of” or “any N of”)</option>
              )}
            </select>
          </div>
          <Button variant="secondary" disabled={!adding} onClick={() => add(adding)}>
            <Plus aria-hidden="true" className="size-5" /> Add
          </Button>
        </div>
      )}
    </section>
  );
}

function RuleEditor({
  rule,
  context,
  position,
}: {
  rule: EditorRule;
  context: Context;
  position: { index: number; count: number };
}) {
  const id = useId();
  const open = context.expanded.has(rule.id) && !context.readOnly;
  const result = context.descriptions.get(rule.id);
  const issues = context.issues.get(rule.id);
  const description =
    result && result.explanation.type !== 'invalid'
      ? describeRequirement(result, context.index)
      : 'Not complete yet';
  const name = `requirement “${rule.label ?? description}”`;
  const update = (next: EditorRule) =>
    context.change(updateNode(context.root, rule.id, () => next));

  return (
    <div
      className={`space-y-2 rounded-md border bg-white p-3 ${issues ? 'border-red-300' : 'border-blue-100'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{ruleTypeLabel(rule.ruleType)}</p>
          {rule.label && <p className="font-semibold">{rule.label}</p>}
          <p>{description}</p>
        </div>
        <span className="flex items-center gap-1">
          {!context.readOnly && (
            <Button
              variant="secondary"
              className="px-3 py-1.5"
              aria-expanded={open}
              aria-controls={`${id}-edit`}
              onClick={() => context.toggle(rule.id)}
            >
              {open ? (
                <ChevronUp aria-hidden="true" className="size-4" />
              ) : (
                <ChevronDown aria-hidden="true" className="size-4" />
              )}
              {open ? 'Done' : 'Edit'} <span className="sr-only">{name}</span>
            </Button>
          )}
          <NodeActions node={rule} name={name} position={position} context={context} />
        </span>
      </div>
      <NodeIssues issues={issues} rule={rule} />
      {open && (
        <div id={`${id}-edit`} className="space-y-4 border-t border-blue-100 pt-3">
          <RuleParamsEditor
            rule={rule}
            catalogue={context.catalogue}
            onChange={(params) => update({ ...rule, params })}
          />
          <div>
            <label htmlFor={`${id}-label`} className="mb-1 block font-semibold">
              Label <span className="font-normal">(optional)</span>
            </label>
            <p className="mb-1 text-sm">
              A short name for admins only. Students always see the description generated from the
              settings.
            </p>
            <input
              id={`${id}-label`}
              value={rule.label ?? ''}
              maxLength={200}
              onChange={(e) => update({ ...rule, label: e.target.value || null })}
              className={inputClasses}
            />
          </div>
        </div>
      )}
    </div>
  );
}
