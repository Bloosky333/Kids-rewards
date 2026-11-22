import { useRef } from 'react'
import type { BoardItem, BonusItem } from '../../lib/types'
import { hhmm } from '../../lib/dates'

interface Props {
  item: BoardItem | BonusItem
  size?: 'sm' | 'lg'
  undoable: boolean
  busy: boolean
  onTap: (el: HTMLElement | null) => void
}

/** A tickable task: to do → ⏳ pending / ✓ done. */
export function TaskChip({ item, size = 'sm', undoable, busy, onTap }: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const state = item.status === 'approved' ? 'done' : item.status === 'pending' ? 'pending' : 'todo'
  const time = 'at_time' in item ? hhmm(item.at_time) : null
  const label =
    state === 'done' ? `${item.name}, fait` : state === 'pending' ? `${item.name}, en attente de validation` : `${item.name}, à faire`
  return (
    <button
      ref={ref}
      type="button"
      className={`chip-task chip-task--${size} is-${state} ${busy ? 'is-busy' : ''}`}
      onClick={() => onTap(ref.current)}
      aria-pressed={state !== 'todo'}
      aria-label={label}
    >
      <span className="chip-task__check" aria-hidden="true">{state === 'done' ? '✓' : state === 'pending' ? '⏳' : ''}</span>
      <span className="chip-task__emoji" aria-hidden="true">{item.emoji}</span>
      <span className="chip-task__body">
        <span className="chip-task__name">{item.name}</span>
        {size === 'lg' && item.description && <span className="chip-task__desc">{item.description}</span>}
        <span className="chip-task__meta">
          {time && <span className="chip-task__time">🕐 {time}</span>}
          <span className={`chip-task__pts ${item.team_applies ? 'is-team' : ''}`}>
            ★ {state === 'todo' ? item.points : item.earned}
          </span>
          {item.team_points != null && (
            <span className="chip-task__team" title={`Ensemble : ★ ${item.team_points} chacun`}>
              👫 {item.team_done}/{item.team_size}
            </span>
          )}
          {item.needs_approval && state === 'todo' && <span className="chip-task__lock" title="Un parent valide">🔐</span>}
        </span>
      </span>
      {undoable && <span className="chip-task__undo">Annuler</span>}
    </button>
  )
}
