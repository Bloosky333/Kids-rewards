import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminListRewards, deleteReward, upsertReward } from '../../lib/api'
import { groupByCategory } from '../../lib/grouping'
import { qk, useCategories } from '../../lib/queries'
import type { Category, Reward } from '../../lib/types'
import { ConfirmDialog, Modal } from '../../components/Modal'
import { EmojiField } from '../../components/EmojiPicker'
import { PointsBadge } from '../../components/PointsBadge'
import { Stepper, Switch } from './fields'
import { useAdminAction, useAdminQueryFn } from './useAdmin'

type Draft = Omit<Reward, 'id'> & { id: string | null }

export function RewardsAdmin() {
  const run = useAdminAction()
  const cats = useCategories()
  const listFn = useAdminQueryFn<Reward[]>(adminListRewards)
  const items = useQuery({ queryKey: qk.adminRewards, queryFn: listFn, staleTime: 0 })
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<Reward | null>(null)

  const rewardCats = (cats.data ?? []).filter((c) => c.kind === 'reward')
  const groups = groupByCategory(cats.data ?? [], 'reward', items.data ?? [])

  const save = async (d: Draft) => {
    const res = await run((pin) => upsertReward(pin, d), d.id ? 'Modifié ✅' : 'Ajouté ✅')
    if (res.ok) setEditing(null)
  }
  const remove = async () => {
    if (!deleting) return
    const id = deleting.id
    const res = await run((pin) => deleteReward(pin, id), 'Supprimé 🗑️')
    if (res.ok || res.error === 'not_found') setDeleting(null)
  }

  return (
    <section>
      <div className="admin-head">
        <h1>🎁 Boutique</h1>
        <button className="btn" disabled={rewardCats.length === 0}
          onClick={() => setEditing({ id: null, name: '', emoji: '', cost: 10, category_id: rewardCats[0]?.id ?? '', active: true })}>
          ➕ Nouvelle récompense
        </button>
      </div>
      {cats.isSuccess && rewardCats.length === 0 && (
        <p className="banner banner--info">Crée d'abord une catégorie de boutique dans <Link to="/parent/categories">🗂️ Catégories</Link>.</p>
      )}
      {items.isPending && <p className="muted">Chargement…</p>}
      {items.isError && <p className="banner banner--warn">{(items.error as Error).message}</p>}
      {items.isSuccess && items.data.length === 0 && rewardCats.length > 0 && <p className="muted">Aucune récompense pour l'instant.</p>}

      {groups.map((g) => (
        <section key={g.category.id} className={`admin-group c-${g.category.color}`}>
          <h2 className="admin-group__title">{g.category.emoji} {g.category.name}</h2>
          <ul className="rows">
            {g.items.map((it) => (
              <li key={it.id} className={`row ${it.active ? '' : 'row--inactive'}`}>
                <span className="row__emoji" aria-hidden="true">{it.emoji}</span>
                <span className="row__main">
                  <span className="row__name">{it.name}</span>
                  <span className="row__meta">
                    <PointsBadge value={it.cost} size="sm" />
                    {!it.active && <span className="tag">Masqué</span>}
                  </span>
                </span>
                <span className="row__actions">
                  <Switch checked={it.active} onChange={() => save({ ...it, active: !it.active })} label={`${it.name} visible`} />
                  <button className="icon-btn" aria-label={`Modifier ${it.name}`} onClick={() => setEditing({ ...it })}>✏️</button>
                  <button className="icon-btn" aria-label={`Supprimer ${it.name}`} onClick={() => setDeleting(it)}>🗑️</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && <RewardForm draft={editing} categories={rewardCats} onCancel={() => setEditing(null)} onSave={save} />}
      {deleting && (
        <ConfirmDialog
          title="Supprimer cette récompense ?"
          message={<>« {deleting.emoji} {deleting.name} » sera supprimée définitivement.</>}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </section>
  )
}

function RewardForm({ draft, categories, onCancel, onSave }: { draft: Draft; categories: Category[]; onCancel: () => void; onSave: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState(draft)
  const [busy, setBusy] = useState(false)
  const name = d.name.trim()
  const valid = name.length >= 1 && name.length <= 40 && !!d.emoji && Number.isInteger(d.cost) && d.cost >= 1 && d.cost <= 9999 && !!d.category_id
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    await onSave({ ...d, name })
    setBusy(false)
  }
  return (
    <Modal
      title={`${d.id ? 'Modifier' : 'Nouvelle'} récompense`}
      onClose={onCancel}
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" form="reward-form" className="btn" disabled={!valid || busy}>{busy ? '…' : 'Enregistrer'}</button>
      </>}
    >
      <form id="reward-form" className="form" onSubmit={submit}>
        <div className="form__row">
          <EmojiField value={d.emoji} onChange={(emoji) => setD({ ...d, emoji })} />
          <label className="field field--grow">
            <span className="field__label">Nom</span>
            <input value={d.name} maxLength={40} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="30 min de tablette" autoFocus required />
          </label>
        </div>
        <div className="form__row">
          <Stepper label="Prix 🪙" value={d.cost} min={1} max={9999} onChange={(cost) => setD({ ...d, cost })} />
          <label className="field field--grow">
            <span className="field__label">Catégorie</span>
            <select value={d.category_id} onChange={(e) => setD({ ...d, category_id: e.target.value })} required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field field--inline">
          <Switch checked={d.active} onChange={(active) => setD({ ...d, active })} />
          <span>{d.active ? 'Visible pour les enfants' : 'Masqué pour les enfants'}</span>
        </label>
      </form>
    </Modal>
  )
}
