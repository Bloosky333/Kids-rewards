import { useEffect } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { KID_SPACE_IDLE_MS, slotInfo } from '../../lib/constants'
import { formatDay } from '../../lib/dates'
import { useBoard } from '../../lib/queries'
import type { BoardItem, BoardKid, BonusItem } from '../../lib/types'
import { ShopPage } from '../kids/ShopPage'
import { currentSlot, groupBySlot } from '../board/slots'
import { TaskChip } from '../board/TaskChip'
import { useTick } from '../board/useTick'

/** Back to the board after a while without touches (shared tablet). */
function useIdleReturn() {
  const navigate = useNavigate()
  useEffect(() => {
    let t = window.setTimeout(() => navigate('/'), KID_SPACE_IDLE_MS)
    const reset = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => navigate('/'), KID_SPACE_IDLE_MS)
    }
    const evs = ['pointerdown', 'keydown', 'scroll', 'wheel'] as const
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true, capture: true }))
    return () => {
      window.clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, reset, { capture: true }))
    }
  }, [navigate])
}

export function KidSpace() {
  const { kidId } = useParams()
  const board = useBoard('today')
  useIdleReturn()
  const kid = board.data?.kids.find((k) => k.id === kidId)

  if (board.isSuccess && !kid) return <Navigate to="/" replace />

  return (
    <div className={`kidspace ${kid ? `c-${kid.color}` : ''}`}>
      <header className="kidspace__head">
        <Link to="/" className="backbtn" aria-label="Retour au tableau de la famille">
          <span className="backbtn__icon" aria-hidden="true">🏠</span>
          <span className="backbtn__label">Tableau</span>
        </Link>
        {kid && (
          <div className="kidspace__who">
            <span className="kidspace__avatar" aria-hidden="true">{kid.emoji}</span>
            <div>
              <div className="kidspace__name">{kid.name}</div>
              <div className="kidspace__pts">★ {kid.totals.approved} aujourd'hui</div>
            </div>
          </div>
        )}
      </header>
      <main className="kids__main kidspace__main">
        {!kid ? (
          <div className="grid">{[0, 1, 2].map((i) => <div key={i} className="card card--skeleton" />)}</div>
        ) : (
          <Routes>
            <Route index element={<MyDay kid={kid} />} />
            <Route path="boutique" element={<ShopPage />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        )}
      </main>
      <nav className="tabbar" aria-label="Navigation">
        <div className="dock">
          <NavLink to={`/enfant/${kidId}`} end className="dock__tab"><span className="dock__emoji" aria-hidden="true">📅</span><span>Ma journée</span></NavLink>
          <NavLink to={`/enfant/${kidId}/boutique`} className="dock__tab"><span className="dock__emoji" aria-hidden="true">🎁</span><span>Boutique</span></NavLink>
        </div>
      </nav>
    </div>
  )
}

function MyDay({ kid }: { kid: BoardKid }) {
  const board = useBoard('today').data
  const { toggle, busy } = useTick(board)
  const now = currentSlot()
  const groups = groupBySlot(kid.items).sort((a, b) => Number(b.slot === now) - Number(a.slot === now))
  const chip = (it: BoardItem | BonusItem) => (
    <TaskChip key={it.task_id} item={it} size="lg" busy={busy === `${kid.id}:${it.task_id}`} onTap={(el) => toggle(kid, it, el)} />
  )
  return (
    <section className="page">
      <h1 className="page-title"><span aria-hidden="true">📅</span> Ma journée</h1>
      {board && <p className="muted page-sub">{formatDay(board.date)}</p>}
      {groups.length === 0 && kid.bonus.length === 0 && (
        <div className="empty"><p className="empty__emoji">🌈</p><p>Rien de prévu aujourd'hui.</p></div>
      )}
      {groups.map((g) => {
        const s = slotInfo(g.slot)
        return (
          <section key={g.slot} className={`group ${g.slot === now ? 'is-now' : ''}`}>
            <h2 className="group__title">
              <span className="group__icon" aria-hidden="true">{s.emoji}</span>{s.label}
              {g.slot === now && <span className="slotgroup__now">maintenant</span>}
            </h2>
            <div className="bigchips">{g.items.map(chip)}</div>
          </section>
        )
      })}
      {kid.bonus.length > 0 && (
        <section className="group group--bonus">
          <h2 className="group__title"><span className="group__icon" aria-hidden="true">🎁</span>Bonus</h2>
          <p className="muted page-sub">En plus, si tu veux : une fois par jour ✨</p>
          <div className="bigchips">{kid.bonus.map(chip)}</div>
        </section>
      )}
    </section>
  )
}
