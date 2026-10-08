// pnpm --filter @xcel/backend db:seed:mentors — development mentors with placeholder emails.
// Real contact addresses are added through the admin API, never committed here.
import type { MentoringTopicCode } from '@xcel/shared';
import { getDatabase } from '../client';
import { getEnv } from '../../env';
import { mentorExpertise, mentors } from '../schema';

if (getEnv().NODE_ENV === 'production' || /neon\.tech/.test(getEnv().DATABASE_URL)) {
  console.error('Refusing to load placeholder mentors into a production database.');
  process.exit(1);
}

const MENTORS: {
  slug: string;
  fullName: string;
  contactEmail: string;
  topics: MentoringTopicCode[];
}[] = [
  {
    slug: 'evans-kwasi',
    fullName: 'Evans Kwasi',
    contactEmail: 'evans.kwasi@example.com',
    topics: ['choosing_programme', 'application_guidance', 'general_guidance'],
  },
  {
    slug: 'aaron-alan-cobbinah',
    fullName: 'Aaron Alan Cobbinah',
    contactEmail: 'aaron.cobbinah@example.com',
    topics: ['wassce_requirements', 'scholarship_guidance', 'general_guidance'],
  },
];

const database = getDatabase();
try {
  for (const { topics, ...mentor } of MENTORS) {
    const [created] = await database.db
      .insert(mentors)
      .values({ ...mentor, status: 'active' })
      .onConflictDoNothing({ target: mentors.slug })
      .returning({ id: mentors.id });
    if (!created) {
      console.log(`${mentor.fullName} is already loaded; nothing changed.`);
      continue;
    }
    await database.db
      .insert(mentorExpertise)
      .values(topics.map((value) => ({ mentorId: created.id, kind: 'topic' as const, value })));
    console.log(`Added ${mentor.fullName} (${mentor.contactEmail}).`);
  }
} finally {
  await database.sql.end();
}
