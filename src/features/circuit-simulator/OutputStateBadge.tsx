type Props = { active: boolean; label?: string };

export default function OutputStateBadge({ active, label }: Props) {
  return <span className={`part-state-badge ${active ? 'active' : 'inactive'}`}>{label ?? (active ? 'ON' : 'OFF')}</span>;
}
