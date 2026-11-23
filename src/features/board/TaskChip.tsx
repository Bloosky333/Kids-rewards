import { useRef } from 'react'
import type { BoardItem, BonusItem } from '../../lib/types'
import { hhmm } from '../../lib/dates'

interface Props {
  item: BoardItem | BonusItem
  size?: 'sm' | 'lg'
  busy: boolean
  onTap: (el: HTMLElement | null) => void
}

/** A task you tap to tick / untick. */
export function TaskChip({ item, size = 'sm', busy, onTap }: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const done = !!item.status
  const time = 'at_time' in item ? hhmm(item.at_time) : null
  return (
    <button
      ref={ref}
      type="button"
      className={`chip-task chip-task--${size} ${done ? 'is-done' : 'is-todo'} ${busy ? 'is-busy' : ''}`}
      onClick={() => onTap(ref.current)}
      aria-pressed={done}
      aria-label={`${item.name}, ${done ? 'fait' : 'à faire'}`}
    >
      <span className="chip-task__check" aria-hidden="true">{done ? '✓' : ''}</span>
      <span className="chip-task__emoji" aria-hidden="true">{item.emoji}</span>
      <span className="chip-task__body">
        <span className="chip-task__name">{item.name}</span>
        {size === 'lg' && item.description && <span className="chip-task__desc">{item.description}</span>}
        <span className="chip-task__meta">
          {time && <span className="chip-task__time">🕐 {time}</span>}
          <span className={`chip-task__pts ${item.team_applies ? 'is-team' : ''}`}>★ {done ? item.earned : item.points}</span>
          {item.team_points != null && (
            <span className="chip-task__team" title={`Ensemble : ★ ${item.team_points} chacun`}>
              👫 {item.team_done}/{item.team_size}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
