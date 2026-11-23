import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { slotInfo } from '../../lib/constants'
import type { Board, BoardItem, BoardKid, BonusItem } from '../../lib/types'
import { currentSlot, groupBySlot, isPastSlot } from './slots'
import { TaskChip } from './TaskChip'

interface Props {
  kid: BoardKid
  board: Board
  index: number
  busy: string | null
  onTap: (kid: BoardKid, item: BoardItem | BonusItem, el: HTMLElement | null) => void
}

export function KidColumn({ kid, board, index, busy, onTap }: Props) {
  const groups = groupBySlot(kid.items)
  const now = board.is_today ? currentSlot() : null
  const finished = kid.totals.planned > 0 && kid.totals.done >= kid.totals.planned
  const chip = (it: BoardItem | BonusItem) => (
    <TaskChip key={it.task_id} item={it} busy={busy === `${kid.id}:${it.task_id}`} onTap={(el) => onTap(kid, it, el)} />
  )
  return (
    <section className={`kidcol c-${kid.color} ${finished ? 'is-finished' : ''}`} style={{ '--i': index } as CSSProperties} aria-label={kid.name}>
      <header className="kidcol__head">
        <Link to={`/enfant/${kid.id}`} className="kidcol__avatar" aria-label={`Ouvrir l'espace de ${kid.name}`}>
          <span aria-hidden="true">{kid.emoji}</span>
        </Link>
        <div className="kidcol__who">
          <Link to={`/enfant/${kid.id}`} className="kidcol__name">{kid.name}</Link>
          <div className="kidcol__pts"><span className="kidcol__earned">★ {kid.totals.approved}</span></div>
        </div>
      </header>

      {finished && <div className="kidcol__bravo">🎉 Journée terminée, bravo {kid.name} !</div>}

      <div className="kidcol__slots">
        {groups.length === 0 && kid.bonus.length === 0 && (
          <p className="kidcol__empty">Rien de prévu {board.is_today ? "aujourd'hui" : 'ce jour-là'} 🌈</p>
        )}
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
              <div className="slotgroup__items">{g.items.map(chip)}</div>
            </div>
          )
        })}
        {kid.bonus.length > 0 && (
          <div className="slotgroup slotgroup--bonus">
            <h3 className="slotgroup__title"><span aria-hidden="true">🎁</span> Bonus</h3>
            <div className="slotgroup__items">{kid.bonus.map(chip)}</div>
          </div>
        )}
      </div>
    </section>
  )
}
