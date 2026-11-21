import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { EmojiField } from '../../components/EmojiPicker'
import { FREQUENCIES } from '../../lib/constants'
import type { Category, CategoryKind, Frequency } from '../../lib/types'

export interface ItemDraft {
  id: string | null
  name: string
  emoji: string
  value: number
  category_id: string
  frequency: Frequency
  active: boolean
}

interface Props {
  kind: CategoryKind
  draft: ItemDraft
  categories: Category[]
  onCancel: () => void
  onSave: (d: ItemDraft) => Promise<void>
}

export function ItemForm({ kind, draft, categories, onCancel, onSave }: Props) {
  const isTask = kind === 'task'
  const [d, setD] = useState(draft)
  const [busy, setBusy] = useState(false)
  const max = isTask ? 999 : 9999
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setD((x) => ({ ...x, [k]: v }))

  const name = d.name.trim()
  const valid = name.length >= 1 && name.length <= 40 && !!d.emoji && Number.isInteger(d.value) && d.value >= 1 && d.value <= max && !!d.category_id

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    await onSave({ ...d, name })
    setBusy(false)
  }

  const title = `${d.id ? 'Modifier' : 'Nouvelle'} ${isTask ? 'mission' : 'récompense'}`
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Annuler</button>
          <button type="submit" form="item-form" className="btn" disabled={!valid || busy}>{busy ? '…' : 'Enregistrer'}</button>
        </>
      }
    >
      <form id="item-form" className="form" onSubmit={submit}>
        <div className="form__row">
          <EmojiField value={d.emoji} onChange={(e) => set('emoji', e)} />
          <label className="field field--grow">
            <span className="field__label">Nom</span>
            <input
              value={d.name}
              maxLength={40}
              onChange={(e) => set('name', e.target.value)}
              placeholder={isTask ? 'Faire son lit' : '30 min de tablette'}
              autoFocus
              required
            />
          </label>
        </div>

        <div className="form__row">
          <label className="field">
            <span className="field__label">{isTask ? 'Points gagnés 🪙' : 'Prix 🪙'}</span>
            <div className="stepper">
              <button type="button" onClick={() => set('value', Math.max(1, d.value - 1))} aria-label="Moins">−</button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={max}
                value={Number.isNaN(d.value) ? '' : d.value}
                onChange={(e) => set('value', parseInt(e.target.value, 10))}
                required
              />
              <button type="button" onClick={() => set('value', Math.min(max, (d.value || 0) + 1))} aria-label="Plus">+</button>
            </div>
          </label>
          <label className="field field--grow">
            <span className="field__label">Catégorie</span>
            <select value={d.category_id} onChange={(e) => set('category_id', e.target.value)} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </label>
        </div>

        {isTask && (
          <fieldset className="field">
            <legend className="field__label">Fréquence</legend>
            <div className="chips">
              {FREQUENCIES.map((f) => (
                <label key={f.value} className={`chip ${d.frequency === f.value ? 'is-on' : ''}`}>
                  <input type="radio" name="frequency" value={f.value} checked={d.frequency === f.value} onChange={() => set('frequency', f.value)} />
                  {f.emoji} {f.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="field field--inline">
          <span className="switch">
            <input type="checkbox" checked={d.active} onChange={(e) => set('active', e.target.checked)} />
            <span className="switch__track" />
          </span>
          <span>{d.active ? 'Visible pour les enfants' : 'Masqué pour les enfants'}</span>
        </label>
      </form>
    </Modal>
  )
}
