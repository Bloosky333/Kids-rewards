import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminListRewards, adminListTasks, deleteReward, deleteTask, upsertReward, upsertTask } from '../../lib/api'
import { frequencyLabel } from '../../lib/constants'
import { groupByCategory } from '../../lib/grouping'
import { qk, useCategories } from '../../lib/queries'
import type { CategoryKind, Reward, Task } from '../../lib/types'
import { ConfirmDialog } from '../../components/Modal'
import { PointsBadge, TeamBadge } from '../../components/PointsBadge'
import { useAdminAction, useAdminQueryFn } from './useAdmin'
import { ItemForm, type ItemDraft } from './ItemForm'

type Item = (Task | Reward) & { value: number }

const toItem = (x: Task | Reward): Item => ({ ...x, value: 'points' in x ? x.points : x.cost })

const toDraft = (it: Item): ItemDraft => ({
  id: it.id, name: it.name, emoji: it.emoji, value: it.value, category_id: it.category_id,
  frequency: 'frequency' in it ? it.frequency : 'anytime', active: it.active,
  description: 'description' in it ? it.description ?? '' : '',
  team: 'team_points' in it ? it.team_points : null,
})

export function ItemsAdmin({ kind }: { kind: CategoryKind }) {
  const isTask = kind === 'task'
  const run = useAdminAction()
  const cats = useCategories()
  const listFn = useAdminQueryFn<(Task | Reward)[]>(isTask ? adminListTasks : adminListRewards)
  const items = useQuery({ queryKey: isTask ? qk.adminTasks : qk.adminRewards, queryFn: listFn, staleTime: 0 })

  const [editing, setEditing] = useState<ItemDraft | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)

  const kindCats = (cats.data ?? []).filter((c) => c.kind === kind)
  const all = (items.data ?? []).map(toItem)
  const groups = groupByCategory(cats.data ?? [], kind, all)
  const label = isTask ? 'mission' : 'récompense'

  const save = async (d: ItemDraft) => {
    const res = isTask
      ? await run((pin) => upsertTask(pin, { id: d.id, name: d.name, emoji: d.emoji, points: d.value, category_id: d.category_id, frequency: d.frequency, active: d.active, description: d.description || null, team_points: d.team }), d.id ? 'Modifié ✅' : 'Ajouté ✅')
      : await run((pin) => upsertReward(pin, { id: d.id, name: d.name, emoji: d.emoji, cost: d.value, category_id: d.category_id, active: d.active }), d.id ? 'Modifié ✅' : 'Ajouté ✅')
    if (res.ok) setEditing(null)
  }

  const toggleActive = (it: Item) => save({ ...toDraft(it), active: !it.active })

  const remove = async () => {
    if (!deleting) return
    const id = deleting.id
    const res = await run((pin) => (isTask ? deleteTask(pin, id) : deleteReward(pin, id)), 'Supprimé 🗑️')
    if (res.ok || res.error === 'not_found') setDeleting(null)
  }

  const newDraft = (): ItemDraft => ({
    id: null, name: '', emoji: '', value: isTask ? 1 : 10, category_id: kindCats[0]?.id ?? '', frequency: 'anytime', active: true,
    description: '', team: null,
  })

  return (
    <section>
      <div className="admin-head">
        <h1>{isTask ? '🎯 Missions' : '🎁 Boutique'}</h1>
        <button className="btn" onClick={() => setEditing(newDraft())} disabled={kindCats.length === 0}>
          ➕ {isTask ? 'Nouvelle mission' : 'Nouvelle récompense'}
        </button>
      </div>

      {cats.isSuccess && kindCats.length === 0 && (
        <p className="banner banner--info">
          Crée d'abord une catégorie {isTask ? 'de missions' : 'de boutique'} dans <Link to="/parent/categories">🗂️ Catégories</Link>.
        </p>
      )}
      {items.isPending && <p className="muted">Chargement…</p>}
      {items.isError && <p className="banner banner--warn">{(items.error as Error).message}</p>}
      {items.isSuccess && all.length === 0 && kindCats.length > 0 && (
        <p className="muted">Aucune {label} pour l'instant. Ajoute la première !</p>
      )}

      {groups.map((g) => (
        <section key={g.category.id} className={`admin-group c-${g.category.color}`}>
          <h2 className="admin-group__title">{g.category.emoji} {g.category.name}</h2>
          <ul className="rows">
            {g.items.map((it) => (
              <li key={it.id} className={`row ${it.active ? '' : 'row--inactive'}`}>
                <span className="row__emoji" aria-hidden="true">{it.emoji}</span>
                <span className="row__main">
                  <span className="row__name">{it.name}</span>
                  {'description' in it && it.description && <span className="row__desc">{it.description}</span>}
                  <span className="row__meta">
                    <PointsBadge value={it.value} size="sm" />
                    {'team_points' in it && it.team_points !== null && <TeamBadge value={it.team_points} size="sm" />}
                    {'frequency' in it && <span className="freq freq--sm">{frequencyLabel(it.frequency).label}</span>}
                    {!it.active && <span className="tag">Masqué</span>}
                  </span>
                </span>
                <span className="row__actions">
                  <label className="switch" title={it.active ? 'Visible pour les enfants' : 'Masqué pour les enfants'}>
                    <input type="checkbox" checked={it.active} onChange={() => toggleActive(it)} aria-label={`${it.name} visible`} />
                    <span className="switch__track" />
                  </label>
                  <button
                    className="icon-btn"
                    aria-label={`Modifier ${it.name}`}
                    onClick={() => setEditing(toDraft(it))}
                  >✏️</button>
                  <button className="icon-btn" aria-label={`Supprimer ${it.name}`} onClick={() => setDeleting(it)}>🗑️</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && (
        <ItemForm
          kind={kind}
          draft={editing}
          categories={kindCats}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Supprimer cette ${label} ?`}
          message={<>« {deleting.emoji} {deleting.name} » sera supprimée définitivement.</>}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </section>
  )
}
