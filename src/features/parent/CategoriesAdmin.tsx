import { useState, type FormEvent } from 'react'
import { deleteCategory, reorderCategories, upsertCategory } from '../../lib/api'
import { COLORS } from '../../lib/constants'
import { useCategories } from '../../lib/queries'
import type { Category, CategoryKind, ColorToken } from '../../lib/types'
import { ConfirmDialog, Modal } from '../../components/Modal'
import { EmojiField } from '../../components/EmojiPicker'
import { useAdminAction } from './useAdmin'

interface Draft { id: string | null; name: string; emoji: string; color: ColorToken }

export function CategoriesAdmin() {
  const [kind, setKind] = useState<CategoryKind>('task')
  const cats = useCategories()
  const run = useAdminAction()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const list = (cats.data ?? [])
    .filter((c) => c.kind === kind)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'fr'))

  const move = (index: number, delta: number) => {
    const ids = list.map((c) => c.id)
    const j = index + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    run((pin) => reorderCategories(pin, kind, ids))
  }

  const save = async (d: Draft) => {
    const res = await run((pin) => upsertCategory(pin, { ...d, kind }), d.id ? 'Catégorie modifiée ✅' : 'Catégorie ajoutée ✅')
    if (res.ok) setEditing(null)
  }

  const remove = async () => {
    if (!deleting) return
    const id = deleting.id
    await run((pin) => deleteCategory(pin, id), 'Catégorie supprimée 🗑️')
    setDeleting(null)
  }

  return (
    <section>
      <div className="admin-head">
        <h1>🗂️ Catégories</h1>
        <button className="btn" onClick={() => setEditing({ id: null, name: '', emoji: '', color: 'mint' })}>➕ Nouvelle catégorie</button>
      </div>

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={kind === 'task'} className={kind === 'task' ? 'is-on' : ''} onClick={() => setKind('task')}>🎯 Missions</button>
        <button role="tab" aria-selected={kind === 'reward'} className={kind === 'reward' ? 'is-on' : ''} onClick={() => setKind('reward')}>🎁 Boutique</button>
      </div>

      {cats.isPending && <p className="muted">Chargement…</p>}
      {cats.isSuccess && list.length === 0 && <p className="muted">Aucune catégorie. Ajoute la première !</p>}

      <ul className="rows">
        {list.map((c, i) => (
          <li key={c.id} className={`row row--cat c-${c.color}`}>
            <span className="row__emoji" aria-hidden="true">{c.emoji}</span>
            <span className="row__main"><span className="row__name">{c.name}</span></span>
            <span className="row__actions">
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${c.name}`}>⬆️</button>
              <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Descendre ${c.name}`}>⬇️</button>
              <button className="icon-btn" onClick={() => setEditing({ id: c.id, name: c.name, emoji: c.emoji, color: c.color })} aria-label={`Modifier ${c.name}`}>✏️</button>
              <button className="icon-btn" onClick={() => setDeleting(c)} aria-label={`Supprimer ${c.name}`}>🗑️</button>
            </span>
          </li>
        ))}
      </ul>

      {editing && <CategoryForm draft={editing} kind={kind} onCancel={() => setEditing(null)} onSave={save} />}
      {deleting && (
        <ConfirmDialog
          title="Supprimer cette catégorie ?"
          message={<>« {deleting.emoji} {deleting.name} » sera supprimée. Elle doit être vide.</>}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </section>
  )
}

function CategoryForm({ draft, kind, onCancel, onSave }: { draft: Draft; kind: CategoryKind; onCancel: () => void; onSave: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState(draft)
  const [busy, setBusy] = useState(false)
  const name = d.name.trim()
  const valid = name.length >= 1 && name.length <= 30 && !!d.emoji

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    await onSave({ ...d, name })
    setBusy(false)
  }

  return (
    <Modal
      title={`${d.id ? 'Modifier' : 'Nouvelle'} catégorie ${kind === 'task' ? 'de missions' : 'de boutique'}`}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Annuler</button>
          <button type="submit" form="cat-form" className="btn" disabled={!valid || busy}>{busy ? '…' : 'Enregistrer'}</button>
        </>
      }
    >
      <form id="cat-form" className="form" onSubmit={submit}>
        <div className="form__row">
          <EmojiField value={d.emoji} onChange={(emoji) => setD({ ...d, emoji })} />
          <label className="field field--grow">
            <span className="field__label">Nom</span>
            <input value={d.name} maxLength={30} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Maison" autoFocus required />
          </label>
        </div>
        <fieldset className="field">
          <legend className="field__label">Couleur</legend>
          <div className="swatches">
            {COLORS.map((c) => (
              <label key={c.value} className={`swatch c-${c.value} ${d.color === c.value ? 'is-on' : ''}`} title={c.label}>
                <input type="radio" name="color" value={c.value} checked={d.color === c.value} onChange={() => setD({ ...d, color: c.value })} aria-label={c.label} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className={`preview-chip c-${d.color}`}>{d.emoji || '❔'} {name || 'Aperçu'}</div>
      </form>
    </Modal>
  )
}
