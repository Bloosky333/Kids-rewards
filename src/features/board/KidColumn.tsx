import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { slotInfo } from '../../lib/constants'
import type { Board, BoardItem, BoardKid } from '../../lib/types'
import { currentSlot, groupBySlot, isPastSlot } from './slots'
import { TaskChip } from './TaskChip'

interface Props {
  kid: BoardKid
  board: Board
  index: number
  isUndoable: (kidId: string, taskId: string) => boolean
  busy: string | null
  onTap: (kid: BoardKid, item: BoardItem, el: HTMLElement | null) => void
}

export function KidColumn({ kid, board, index, isUndoable, busy, onTap }: Props) {
  const groups = groupBySlot(kid.items)
  const now = board.is_today ? currentSlot() : null
  const { done, planned, approved, pending } = kid.totals
  const finished = planned > 0 && done >= planned
  const bonusLeft = kid.bonus.filter((b) => !b.status).length
  return (
    <section className={`kidcol c-${kid.color} ${finished ? 'is-finished' : ''}`} style={{ '--i': index } as CSSProperties} aria-label={kid.name}>
      <header className="kidcol__head">
        <Link to={`/enfant/${kid.id}`} className="kidcol__avatar" aria-label={`Ouvrir l'espace de ${kid.name}`}>
          <span aria-hidden="true">{kid.emoji}</span>
        </Link>
        <div className="kidcol__who">
          <Link to={`/enfant/${kid.id}`} className="kidcol__name">{kid.name}</Link>
          <div className="kidcol__pts">
            <span className="kidcol__earned">★ {approved}</span>
            {pending > 0 && <span className="kidcol__pending">⏳ {pending}</span>}
          </div>
        </div>
        {planned > 0 && (
          <div className="kidcol__progress" aria-label={`${done} sur ${planned} faites`}>
            <span className="kidcol__count">{done}/{planned}</span>
            <span className="kidcol__bar"><span style={{ width: `${(done / planned) * 100}%` }} /></span>
          </div>
        )}
      </header>

      {finished && <div className="kidcol__bravo">🎉 Journée terminée, bravo {kid.name} !</div>}

      <div className="kidcol__slots">
        {groups.length === 0 && <p className="kidcol__empty">Rien de prévu {board.is_today ? "aujourd'hui" : 'ce jour-là'} 🌈</p>}
        {groups.map((g) => {
          const s = slotInfo(g.slot)
          const isNow = now === g.slot
          const past = board.is_today && !isNow && isPastSlot(g.slot)
          return (
            <div key={g.slot} className={`slotgroup ${isNow ? 'is-now' : ''} ${past ? 'is-past' : ''}`}>
              <h3 className="slotgroup__title">
                <span aria-hidden="true">{s.emoji}</span> {s.label}
                {isNow && <span className="slotgroup__now">maintenant</span>}
              </h3>
              <div className="slotgroup__items">
                {g.items.map((it) => (
                  <TaskChip
                    key={it.task_id}
                    item={it}
                    undoable={isUndoable(kid.id, it.task_id)}
                    busy={busy === `${kid.id}:${it.task_id}`}
                    onTap={(el) => onTap(kid, it, el)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {kid.bonus.length > 0 && (
        <Link to={`/enfant/${kid.id}/bonus`} className="kidcol__bonus">
          {board.is_today
            ? <>✨ En plus aujourd'hui : {bonusLeft} mission{bonusLeft > 1 ? 's' : ''} bonus</>
            : <>✨ Missions bonus : {kid.bonus.length}</>}
        </Link>
      )}
    </section>
  )
}
