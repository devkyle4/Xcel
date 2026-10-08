import { type MentoringTopicCode, topicLabel } from '@xcel/shared';

export function TopicChips({
  topics,
  fields = [],
}: {
  topics: MentoringTopicCode[];
  fields?: string[];
}) {
  const items = [...topics.map(topicLabel), ...fields];
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-full bg-blue-50 px-3 py-1 text-sm">
          {item}
        </li>
      ))}
    </ul>
  );
}
