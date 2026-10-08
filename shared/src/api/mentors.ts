import { z } from 'zod';
import {
  MENTOR_STATUSES,
  type MentorStatus,
  MENTORING_TOPICS,
  type MentoringTopicCode,
} from '../domain';
import { paginationQuerySchema } from './queries';

// ---------- Ghana mobile numbers ----------

/**
 * Normalises a Ghana mobile number to +233XXXXXXXXX, or returns null if it is
 * not one. Accepts "0XX XXX XXXX" and "+233 XX XXX XXXX", with any spaces or
 * hyphens. Ghana mobile numbers start with 02 or 05.
 */
export function normaliseGhanaPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  const local = /^0([25]\d{8})$/.exec(digits) ?? /^\+233([25]\d{8})$/.exec(digits);
  return local ? `+233${local[1]}` : null;
}

/** "+233244123456" -> "+233 24 412 3456" for display. */
export function formatGhanaPhone(normalised: string): string {
  const m = /^\+233(\d{2})(\d{3})(\d{4})$/.exec(normalised);
  return m ? `+233 ${m[1]} ${m[2]} ${m[3]}` : normalised;
}

// ---------- Session requests ----------

export const MESSAGE_MAX_LENGTH = 1000;

export const topicLabel = (code: MentoringTopicCode) =>
  MENTORING_TOPICS.find((t) => t.code === code)?.label ?? code;

const TOPIC_CODES = MENTORING_TOPICS.map((t) => t.code) as [
  MentoringTopicCode,
  ...MentoringTopicCode[],
];

/** "Choosing a university programme" -> "choosing a university programme" (acronyms kept). */
function inSentence(label: string) {
  return /^[A-Z][a-z]/.test(label) ? label[0]!.toLowerCase() + label.slice(1) : label;
}

/**
 * The pre-filled message (CLAUDE.md "Default message"). The form refills it
 * as the name and topic change, until the student edits it.
 */
export function defaultSessionMessage(
  mentorName: string,
  studentName: string,
  topic: MentoringTopicCode | '',
): string {
  const name = studentName.trim() || '[your name]';
  const about = topic ? inSentence(topicLabel(topic)) : '[topic]';
  return [
    `Hello ${mentorName},`,
    '',
    `My name is ${name}. I recently completed SHS and I would like to book a mentoring session with you on ${about}.`,
    '',
    'Please contact me on the phone number below to arrange a convenient date and time.',
    '',
    'Thank you.',
  ].join('\n');
}

export const sessionRequestSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(100),
    phone: z
      .string()
      .trim()
      .transform((value, ctx) => {
        const normalised = normaliseGhanaPhone(value);
        if (!normalised) {
          ctx.addIssue({
            code: 'custom',
            message: 'Enter a Ghana mobile number, e.g. 024 412 3456 or +233 24 412 3456',
          });
          return z.NEVER;
        }
        return normalised;
      }),
    email: z
      .union([z.literal(''), z.email('Enter a valid email address, or leave it blank').max(254)])
      .optional()
      .transform((v) => v || null),
    topic: z.enum(TOPIC_CODES, { message: 'Choose a topic' }),
    message: z.string().trim().min(1, 'Write a message').max(MESSAGE_MAX_LENGTH),
    disclaimerAccepted: z.literal(true, {
      message: 'Confirm that you understand mentoring is guidance only',
    }),
    captchaToken: z.string().min(1, 'Complete the security check').max(4096),
  })
  .strict();
export type SessionRequestInput = z.input<typeof sessionRequestSchema>;
export type SessionRequest = z.output<typeof sessionRequestSchema>;

export interface SessionRequestResponse {
  sent: true;
  mentorName: string;
  /** The normalised number the mentor will call, for the confirmation message. */
  phone: string;
}

export interface MentorEmail {
  subject: string;
  text: string;
  replyTo: string | null;
}

/** The email sent to the mentor (CLAUDE.md "Email to mentor"). */
export function buildMentorEmail(request: SessionRequest): MentorEmail {
  const topic = topicLabel(request.topic);
  return {
    subject: `Mentoring request from ${request.fullName} – ${topic}`,
    text: [
      request.message,
      '',
      '──────────────',
      `Name:   ${request.fullName}`,
      `Phone:  ${formatGhanaPhone(request.phone)}`,
      `Email:  ${request.email ?? 'Not provided'}`,
      `Topic:  ${topic}`,
      'Sent via Xcel',
    ].join('\n'),
    replyTo: request.email,
  };
}

// ---------- Public mentor data (never includes the contact email) ----------

export interface MentorSummary {
  slug: string;
  fullName: string;
  headline: string | null;
  photoUrl: string | null;
  topics: MentoringTopicCode[];
  fields: string[];
}

export interface MentorDetail extends MentorSummary {
  bio: string | null;
  background: string | null;
  programmeAreas: string[];
}

export const mentorQuerySchema = paginationQuerySchema.extend({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  topic: z.enum(TOPIC_CODES).optional(),
  field: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
});

// ---------- Admin ----------

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));

const mentorFields = {
  fullName: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens')
    .optional(),
  headline: text(150),
  photoUrl: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .nullable()
    .optional(),
  bio: text(3000),
  background: text(3000),
  /** Private: session requests are sent here and it is never shown publicly. */
  contactEmail: z.email().max(254),
};
export const mentorCreateSchema = z.object(mentorFields).strict();
export const mentorUpdateSchema = z
  .object(mentorFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to change' });
export const mentorStatusChangeSchema = z.object({ status: z.enum(MENTOR_STATUSES) }).strict();

const labels = z
  .array(z.string().trim().min(1).max(100))
  .max(20)
  .transform((v) => [...new Set(v)]);
export const mentorExpertiseSchema = z
  .object({
    topics: z.array(z.enum(TOPIC_CODES)).max(TOPIC_CODES.length),
    fields: labels,
    programmeAreas: labels,
  })
  .strict();

export interface AdminMentor extends MentorDetail {
  id: string;
  contactEmail: string;
  status: MentorStatus;
  createdAt: string;
  updatedAt: string;
  /** Session requests sent in the last 12 months (counts only). */
  requestsSent: number;
}
