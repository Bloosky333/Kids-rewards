import type { CSSProperties } from 'react'
import { PointsBadge, TeamBadge } from '../../components/PointsBadge'
import type { ColorToken } from '../../lib/types'

interface Props {
  emoji: string
  name: string
  value: number
  color: ColorToken
  description?: string | null
  teamPoints?: number | null
  index: number
}

export function ItemCard({ emoji, name, value, color, description, teamPoints, index }: Props) {
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
      </div>
    </article>
  )
}
