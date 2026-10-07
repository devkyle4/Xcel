import { z } from 'zod';
import { type PublishStatus, REQUIREMENT_OPERATORS, type RequirementOperator } from '../domain';
import type { EligibilityResult, RequirementGroupNode, TreeIssue } from '../eligibility';
import { studentResultsSchema } from '../eligibility';
import type { AdminVerificationRecord } from './admin-content';
import { academicYearSchema } from './queries';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));
const url = z
  .url({ protocol: /^https?$/, message: 'Enter a full http:// or https:// URL' })
  .max(2048)
  .nullable()
  .optional();
const isoDate = z.iso.date().nullable().optional();

const cycleFields = {
  academicYear: academicYearSchema,
  applicationOpensOn: isoDate,
  applicationDeadline: isoDate,
  applicationUrl: url,
  notes: text(2000),
};
const datesInOrder = (v: {
  applicationOpensOn?: string | null;
  applicationDeadline?: string | null;
}) =>
  !v.applicationOpensOn || !v.applicationDeadline || v.applicationOpensOn <= v.applicationDeadline;
const DATES_MESSAGE = {
  message: 'The opening date must be on or before the deadline',
  path: ['applicationDeadline'],
};

export const cycleCreateSchema = z.object(cycleFields).strict().refine(datesInOrder, DATES_MESSAGE);
export const cycleUpdateSchema = z
  .object(cycleFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to change' })
  .refine(datesInOrder, DATES_MESSAGE);

// ---------- Requirement tree input ----------

export const MAX_REQUIREMENT_DEPTH = 6;
export const MAX_REQUIREMENT_NODES = 300;

export interface RequirementRuleInput {
  kind: 'rule';
  id?: string;
  ruleType: string;
  params: Record<string, unknown>;
  label?: string | null;
}

export interface RequirementGroupInput {
  kind: 'group';
  id?: string;
  operator: RequirementOperator;
  minCount?: number | null;
  label?: string | null;
  children: (RequirementGroupInput | RequirementRuleInput)[];
}

const ruleInputSchema = z
  .object({
    kind: z.literal('rule'),
    /** Ignored: saved nodes always get new ids. Accepted so a loaded tree can be sent back. */
    id: z.string().optional(),
    ruleType: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/)
      .max(64),
    params: z.record(z.string(), z.unknown()),
    label: text(200),
  })
  .strict();

const groupInputSchema: z.ZodType<RequirementGroupInput> = z.lazy(() =>
  z
    .object({
      kind: z.literal('group'),
      id: z.string().optional(),
      operator: z.enum(REQUIREMENT_OPERATORS),
      minCount: z.int().min(1).max(50).nullable().optional(),
      label: text(200),
      children: z.array(z.union([ruleInputSchema, groupInputSchema])).max(50),
    })
    .strict()
    .refine((g) => (g.operator === 'at_least') === (g.minCount != null), {
      message: '"Any N of" groups need a count; other groups must not have one',
      path: ['minCount'],
    }),
);

/** Group nesting depth (rules do not add a level) and total number of nodes. */
function measure(node: RequirementGroupInput | RequirementRuleInput): {
  depth: number;
  nodes: number;
} {
  if (node.kind === 'rule') return { depth: 0, nodes: 1 };
  const children = node.children.map(measure);
  return {
    depth: 1 + Math.max(0, ...children.map((c) => c.depth)),
    nodes: 1 + children.reduce((sum, c) => sum + c.nodes, 0),
  };
}

/** A whole requirement tree, saved at once. Null removes all requirements. */
export const requirementsInputSchema = z
  .object({ requirements: groupInputSchema.nullable() })
  .strict()
  .superRefine(({ requirements }, ctx) => {
    if (!requirements) return;
    const { depth, nodes } = measure(requirements);
    if (depth > MAX_REQUIREMENT_DEPTH) {
      ctx.addIssue({
        code: 'custom',
        message: `Nest groups at most ${MAX_REQUIREMENT_DEPTH} levels deep`,
        path: ['requirements'],
      });
    }
    if (nodes > MAX_REQUIREMENT_NODES) {
      ctx.addIssue({
        code: 'custom',
        message: `Use at most ${MAX_REQUIREMENT_NODES} groups and rules`,
        path: ['requirements'],
      });
    }
  });

/** Sample results to test a cycle's requirements; never stored or logged. */
export const previewRequestSchema = z.object({ results: studentResultsSchema }).strict();

// ---------- Responses ----------

export interface AdminCycleVersion {
  id: string;
  version: number;
  status: PublishStatus;
  publishedAt: string | null;
}

export interface AdminCycle {
  id: string;
  programmeId: string;
  academicYear: string;
  version: number;
  supersedesCycleId: string | null;
  status: PublishStatus;
  applicationOpensOn: string | null;
  applicationDeadline: string | null;
  applicationUrl: string | null;
  notes: string | null;
  verifiedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** True while the cycle is a never-published draft. */
  editable: boolean;
  programme: { id: string; name: string; universityName: string };
  requirements: RequirementGroupNode | null;
  /** Problems that block marking this cycle Verified or Published. */
  issues: TreeIssue[];
  verifications: AdminVerificationRecord[];
  /** All versions for the same programme and academic year, newest first. */
  versions: AdminCycleVersion[];
}

export type PreviewResponse = EligibilityResult;
