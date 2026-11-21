export function PointsBadge({ value, size = 'md' }: { value: number; size?: 'md' | 'sm' }) {
  return (
    <span className={`points points--${size}`} aria-label={`${value} pièces`}>
      <span className="points__coin" aria-hidden="true">★</span>
      <span className="points__value">{value}</span>
    </span>
  )
}
