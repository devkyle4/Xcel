import type { MentorSummary } from '@xcel/shared';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { MentoringDisclaimer } from '../Disclaimer';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { MentorAvatar } from './MentorAvatar';
import { SessionRequestForm } from './SessionRequestForm';
import { TopicChips } from './TopicChips';

/**
 * Mentor card with an email button. The mentor's address is never shown or
 * sent to the browser: the message box sends the request through the server.
 */
export function MentorCard({ mentor }: { mentor: MentorSummary }) {
  const [open, setOpen] = useState(false);
  const firstName = mentor.fullName.split(/\s+/)[0];

  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-blue-100 bg-white p-4">
      <div className="flex items-center gap-3">
        <MentorAvatar src={mentor.photoUrl} name={mentor.fullName} />
        <div>
          <h3 className="text-lg font-semibold">
            <Link to={`/mentors/${mentor.slug}`}>{mentor.fullName}</Link>
          </h3>
          {mentor.headline && <p className="text-sm">{mentor.headline}</p>}
        </div>
      </div>
      <TopicChips topics={mentor.topics} fields={mentor.fields} />
      <div className="mt-auto pt-2">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Mail aria-hidden="true" className="size-5" /> Email {firstName}
        </Button>
      </div>
      {open && (
        <Modal title={`Email ${mentor.fullName}`} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <MentoringDisclaimer />
            <SessionRequestForm mentorSlug={mentor.slug} mentorName={mentor.fullName} />
          </div>
        </Modal>
      )}
    </article>
  );
}
