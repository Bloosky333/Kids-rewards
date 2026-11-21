export function PointsBadge({ value, size = 'md' }: { value: number; size?: 'md' | 'sm' }) {
  return (
    <span className={`points points--${size}`} aria-label={`${value} pièces`}>
      <span aria-hidden="true">🪙</span> {value}
    </span>
  )
}
