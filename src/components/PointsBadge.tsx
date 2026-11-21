export function PointsBadge({ value, size = 'md' }: { value: number; size?: 'md' | 'sm' }) {
  return (
    <span className={`points points--${size}`} aria-label={`${value} pièces`}>
      <span className="points__coin" aria-hidden="true">★</span>
      <span className="points__value">{value}</span>
    </span>
  )
}

/** "Done together" badge: points EACH kid gets when all kids complete the task. */
export function TeamBadge({ value, size = 'md' }: { value: number; size?: 'md' | 'sm' }) {
  return (
    <span className={`team team--${size}`} aria-label={`Ensemble : ${value} pièces chacun`}>
      <span aria-hidden="true">👫</span>
      {size === 'md' && <span className="team__label">Ensemble</span>}
      <span className="team__value">★ {value}</span>
    </span>
  )
}
