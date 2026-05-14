interface TagChipProps {
  tag: string;
}

function chipClass(tag: string): string {
  const t = tag.replace(/^@/, '');
  if (t === 'smoke')      return 'tag-smoke';
  if (t === 'regression') return 'tag-regression';
  if (t === 'ai-generated') return 'tag-ai';
  return 'tag-default';
}

export function TagChip({ tag }: TagChipProps) {
  const label = tag.startsWith('@') ? tag : `@${tag}`;
  return <span className={chipClass(tag)}>{label}</span>;
}
