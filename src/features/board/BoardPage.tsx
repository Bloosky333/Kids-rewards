import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/Modal'
import { addDays, formatDay } from '../../lib/dates'
import { useBoard, usePendingCount } from '../../lib/queries'
import type { BoardItem, BoardKid } from '../../lib/types'
import { useParentSession } from '../parent/ParentSession'
import { KidColumn } from './KidColumn'
import { useTick } from './useTick'

export function BoardPage() {
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? 'today'
  const board = useBoard(date)
  const pending = usePendingCount()
  const { pin } = useParentSession()
  const { toggle, untick, isUndoable, busy } = useTick(board.data)
  const [confirm, setConfirm] = useState<{ kid: BoardKid; item: BoardItem } | null>(null)
  const [phoneKid, setPhoneKid] = useState<string | null>(null)

  const b = board.data
  const go = (delta: number) => {
    if (!b) return
    const next = addDays(b.date, delta)
    setParams(next === b.today ? {} : { date: next })
  }

  // If the stored date is today, drop the param so the board follows midnight.
  useEffect(() => {
    if (b && date !== 'today' && b.date === b.today) setParams({}, { replace: true })
  }, [b, date, setParams])

  const kids = b?.kids ?? []
  const selected = kids.find((k) => k.id === phoneKid) ?? kids[0]

  const onTap = async (kid: BoardKid, item: BoardItem, el: HTMLElement | null) => {
    const r = await toggle(kid, item, el)
    if (r === 'confirm-untick') setConfirm({ kid, item })
  }

  return (
    <div className="board">
      <header className="board__head">
        <div className="daynav">
          <button className="icon-btn daynav__btn" onClick={() => go(-1)} aria-label="Jour précédent" disabled={!b}>◀</button>
          <div className="daynav__label">
            <h1 className="daynav__date">{b ? formatDay(b.date) : '…'}</h1>
            {b && !b.is_today && (
              <button className="daynav__today" onClick={() => setParams({})}>↩ Aujourd'hui</button>
            )}
            {b?.is_today && <span className="daynav__badge">Aujourd'hui</span>}
          </div>
          <button className="icon-btn daynav__btn" onClick={() => go(1)} aria-label="Jour suivant" disabled={!b}>▶</button>
        </div>
        <Link to="/parent" className="lock-btn lock-btn--inline" aria-label={`Mode parent${pending.data ? `, ${pending.data} à valider` : ''}`}>
          {pin ? '🔓' : '🔒'}
          {!!pending.data && <span className="lock-btn__badge">{pending.data}</span>}
        </Link>
      </header>

      {b && !b.is_today && (
        <p className="banner banner--info board__banner">
          {pin ? '🔓 Mode parent : tu peux corriger ce jour en touchant les missions.' : "👀 Tu regardes un autre jour. Tu peux cocher seulement aujourd'hui."}
        </p>
      )}
      {board.isError && b && <p className="banner banner--warn board__banner">📡 Pas de connexion : voici la dernière version connue.</p>}

      {board.isPending ? (
        <div className="board__cols">{[0, 1].map((i) => <div key={i} className="kidcol kidcol--skeleton" />)}</div>
      ) : board.isError && !b ? (
        <div className="empty">
          <p className="empty__emoji">😕</p>
          <p>Impossible de charger le tableau.</p>
          <button className="btn" onClick={() => board.refetch()}>Réessayer</button>
        </div>
      ) : kids.length === 0 ? (
        <div className="empty">
          <p className="empty__emoji">👨‍👩‍👧‍👦</p>
          <p>Ajoute tes enfants dans le mode parent 🔒 → 👧 Enfants</p>
          <Link className="btn" to="/parent/enfants">Ajouter un enfant</Link>
        </div>
      ) : (
        <>
          {kids.length > 1 && (
            <nav className="kidpicker" aria-label="Choisir un enfant">
              {kids.map((k) => (
                <button key={k.id} className={`kidpicker__chip c-${k.color} ${selected?.id === k.id ? 'is-on' : ''}`} onClick={() => setPhoneKid(k.id)}>
                  <span aria-hidden="true">{k.emoji}</span> {k.name}
                </button>
              ))}
            </nav>
          )}
          <div className={`board__cols board__cols--${Math.min(kids.length, 4)}`}>
            {kids.map((k, i) => (
              <div key={k.id} className={`board__col ${selected?.id === k.id ? 'is-selected' : ''}`}>
                <KidColumn kid={k} board={b!} index={i} isUndoable={isUndoable} busy={busy} onTap={onTap} />
              </div>
            ))}
          </div>
        </>
      )}

      {confirm && (
        <ConfirmDialog
          title="Annuler cette mission ?"
          message={<>« {confirm.item.emoji} {confirm.item.name} » ne sera plus cochée pour {confirm.kid.name}.</>}
          confirmLabel="Oui, annuler"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await untick(confirm.kid, confirm.item)
            setConfirm(null)
          }}
        />
      )}
    </div>
  )
}
