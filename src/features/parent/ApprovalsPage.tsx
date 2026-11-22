import { useQuery } from '@tanstack/react-query'
import { listPending, setCompletionsStatus } from '../../lib/api'
import { formatDay } from '../../lib/dates'
import { qk } from '../../lib/queries'
import type { PendingCompletion } from '../../lib/types'
import { useAdminAction, useAdminQueryFn } from './useAdmin'

export function ApprovalsPage() {
  const fn = useAdminQueryFn<PendingCompletion[]>(listPending)
  const pending = useQuery({ queryKey: qk.adminPending, queryFn: fn, staleTime: 0, refetchInterval: 30_000 })
  const run = useAdminAction()
  const list = pending.data ?? []
  const byDate = list.reduce<Record<string, PendingCompletion[]>>((acc, c) => ((acc[c.date] ??= []).push(c), acc), {})

  const act = (ids: string[], status: 'approved' | 'cancelled') =>
    run((pin) => setCompletionsStatus(pin, ids, status), status === 'approved' ? (ids.length > 1 ? 'Tout est validé ✅' : 'Validé ✅') : 'Refusé ↩️')

  return (
    <section>
      <div className="admin-head">
        <h1>✅ À valider</h1>
        {list.length > 1 && <button className="btn" onClick={() => act(list.map((c) => c.id), 'approved')}>✅ Tout valider ({list.length})</button>}
      </div>
      {pending.isPending && <p className="muted">Chargement…</p>}
      {pending.isError && <p className="banner banner--warn">{(pending.error as Error).message}</p>}
      {pending.isSuccess && list.length === 0 && (
        <div className="empty"><p className="empty__emoji">🌟</p><p>Rien à valider pour l'instant.</p></div>
      )}
      {Object.entries(byDate).map(([date, items]) => (
        <section key={date} className="admin-group">
          <h2 className="admin-group__title">{formatDay(date)}</h2>
          <ul className="rows">
            {items.map((c) => (
              <li key={c.id} className={`row c-${c.kid.color}`}>
                <span className="row__emoji" aria-hidden="true">{c.task.emoji}</span>
                <span className="row__main">
                  <span className="row__name">{c.task.name}</span>
                  <span className="row__meta">
                    <span className="tag">{c.kid.emoji} {c.kid.name}</span>
                    <span className="points points--sm"><span className="points__coin" aria-hidden="true">★</span><span>{c.earned}</span></span>
                    {c.team_applies && <span className="tag">👫 bonus équipe</span>}
                    <span className="row__desc">à {new Date(c.created_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </span>
                <span className="row__actions">
                  <button className="btn btn--small" onClick={() => act([c.id], 'approved')} aria-label={`Valider ${c.task.name} pour ${c.kid.name}`}>✅ Valider</button>
                  <button className="btn btn--small btn--ghost" onClick={() => act([c.id], 'cancelled')} aria-label={`Refuser ${c.task.name} pour ${c.kid.name}`}>↩️</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {list.length > 0 && <p className="form__hint">↩️ Refuser décoche la mission : l'enfant pourra la refaire.</p>}
    </section>
  )
}
