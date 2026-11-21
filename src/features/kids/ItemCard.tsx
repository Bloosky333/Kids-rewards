import type { CSSProperties } from 'react'
import { PointsBadge, TeamBadge } from '../../components/PointsBadge'
import { frequencyLabel } from '../../lib/constants'
import type { ColorToken, Frequency } from '../../lib/types'

interface Props {
  emoji: string
  name: string
  value: number
  color: ColorToken
  frequency?: Frequency
  description?: string | null
  teamPoints?: number | null
  index: number
}

export function ItemCard({ emoji, name, value, color, frequency, description, teamPoints, index }: Props) {
  const f = frequency ? frequencyLabel(frequency) : null
  return (
    <article className={`card c-${color}`} style={{ '--i': index } as CSSProperties} tabIndex={0}>
      <div className="card__bubble">
        <span className="card__emoji" role="img" aria-label={name}>{emoji}</span>
      </div>
      <h3 className="card__name">{name}</h3>
      {description && <p className="card__desc">{description}</p>}
      <div className="card__footer">
        <PointsBadge value={value} />
        {teamPoints != null && <TeamBadge value={teamPoints} />}
        {f && (
          <span className="freq">
            <span aria-hidden="true">{f.emoji}</span> {f.label}
          </span>
        )}
      </div>
    </article>
  )
}
