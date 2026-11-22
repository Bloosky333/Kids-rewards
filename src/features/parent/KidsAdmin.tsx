import { useState, type FormEvent } from 'react'
import { reorderKids, upsertKid } from '../../lib/api'
import { COLORS } from '../../lib/constants'
import type { ColorToken } from '../../lib/types'
import { Modal } from '../../components/Modal'
import { EmojiField } from '../../components/EmojiPicker'
import { Switch } from './fields'
import { useAdminKids } from './TasksAdmin'
import { useAdminAction } from './useAdmin'

interface Draft { id: string | null; name: string; emoji: string; color: ColorToken; active: boolean }

export function KidsAdmin() {
  const kids = useAdminKids()
  const run = useAdminAction()
  const [editing, setEditing] = useState<Draft | null>(null)
  const list = kids.data ?? []
  const usedColors = new Set(list.map((k) => k.color))

  const move = (i: number, delta: number) => {
    const ids = list.map((k) => k.id)
    const j = i + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    run((pin) => reorderKids(pin, ids))
  }
  const save = async (d: Draft) => {
    const res = await run((pin) => upsertKid(pin, d), d.id ? 'Modifié ✅' : 'Enfant ajouté 🎉')
    if (res.ok) setEditing(null)
  }

  return (
    <section>
      <div className="admin-head">
        <h1>👧 Enfants</h1>
        <button className="btn" onClick={() => setEditing({
          id: null, name: '', emoji: '', active: true,
          color: COLORS.find((c) => !usedColors.has(c.value))?.value ?? 'mint',
        })}>➕ Ajouter un enfant</button>
      </div>
      {kids.isPending && <p className="muted">Chargement…</p>}
      {kids.isSuccess && list.length === 0 && <p className="muted">Aucun enfant pour l'instant. Ajoute le premier !</p>}
      <ul className="rows">
        {list.map((k, i) => (
          <li key={k.id} className={`row c-${k.color} ${k.active ? '' : 'row--inactive'}`}>
            <span className="row__emoji row__emoji--kid" aria-hidden="true">{k.emoji}</span>
            <span className="row__main">
              <span className="row__name">{k.name}</span>
              {!k.active && <span className="row__desc">Masqué du tableau (historique conservé)</span>}
            </span>
            <span className="row__actions">
              <Switch checked={k.active} onChange={(active) => save({ ...k, active })} label={`${k.name} affiché`} />
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${k.name}`}>⬆️</button>
              <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Descendre ${k.name}`}>⬇️</button>
              <button className="icon-btn" onClick={() => setEditing({ ...k })} aria-label={`Modifier ${k.name}`}>✏️</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="form__hint">Pour retirer un enfant, désactive-le : il disparaît du tableau mais son historique reste.</p>
      {editing && <KidForm draft={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </section>
  )
}

function KidForm({ draft, onCancel, onSave }: { draft: Draft; onCancel: () => void; onSave: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState(draft)
  const [busy, setBusy] = useState(false)
  const name = d.name.trim()
  const valid = name.length >= 1 && name.length <= 20 && !!d.emoji
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    await onSave({ ...d, name })
    setBusy(false)
  }
  return (
    <Modal
      title={d.id ? `Modifier ${draft.name}` : 'Nouvel enfant'}
      onClose={onCancel}
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" form="kid-form" className="btn" disabled={!valid || busy}>{busy ? '…' : 'Enregistrer'}</button>
      </>}
    >
      <form id="kid-form" className="form" onSubmit={submit}>
        <div className="form__row">
          <EmojiField value={d.emoji} onChange={(emoji) => setD({ ...d, emoji })} label="Avatar" />
          <label className="field field--grow">
            <span className="field__label">Prénom</span>
            <input value={d.name} maxLength={20} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Léa" autoFocus required />
          </label>
        </div>
        <fieldset className="field">
          <legend className="field__label">Couleur</legend>
          <div className="swatches">
            {COLORS.map((c) => (
              <label key={c.value} className={`swatch c-${c.value} ${d.color === c.value ? 'is-on' : ''}`} title={c.label}>
                <input type="radio" name="kidcolor" value={c.value} checked={d.color === c.value} onChange={() => setD({ ...d, color: c.value })} aria-label={c.label} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className={`kid-preview c-${d.color}`}>
          <span className="kidcol__avatar"><span aria-hidden="true">{d.emoji || '🙂'}</span></span>
          <div><div className="kidcol__name">{name || 'Prénom'}</div><div className="kidcol__pts"><span className="kidcol__earned">★ 5</span></div></div>
        </div>
      </form>
    </Modal>
  )
}
