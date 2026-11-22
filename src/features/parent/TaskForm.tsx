import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { EmojiField } from '../../components/EmojiPicker'
import { DAY_PRESETS, SLOTS, WEEKDAYS, daysPreset, slotForTime } from '../../lib/constants'
import type { Category, Kid, Slot, TaskKind, Weekday } from '../../lib/types'
import { Pill, Stepper, Switch } from './fields'

export interface TaskDraft {
  id: string | null
  name: string
  emoji: string
  points: number
  category_id: string
  active: boolean
  description: string
  team: number | null
  kind: TaskKind
  assign_all: boolean
  kid_ids: string[]
  days: Weekday[]
  slot: Slot
  at_time: string
  needs_approval: boolean
}

interface Props {
  draft: TaskDraft
  categories: Category[]
  kids: Kid[]
  onCancel: () => void
  onSave: (d: TaskDraft) => Promise<void>
}

export function TaskForm({ draft, categories, kids, onCancel, onSave }: Props) {
  const [d, setD] = useState(draft)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => setD((x) => ({ ...x, [k]: v }))
  const planned = d.kind === 'planned'
  const preset = daysPreset(d.days)
  const [customDays, setCustomDays] = useState(preset === 'custom')
  const effectiveSlot = slotForTime(d.at_time || null, d.slot)

  const name = d.name.trim()
  const teamOk = d.team === null || (Number.isInteger(d.team) && d.team > d.points && d.team <= 999)
  const kidsOk = d.assign_all || d.kid_ids.length > 0
  const daysOk = !planned || d.days.length > 0
  const valid = name.length >= 1 && name.length <= 40 && !!d.emoji && Number.isInteger(d.points) && d.points >= 1 && d.points <= 999
    && !!d.category_id && teamOk && kidsOk && daysOk && d.description.length <= 120

  const toggleKid = (id: string) => {
    const has = d.kid_ids.includes(id)
    const next = has ? d.kid_ids.filter((k) => k !== id) : [...d.kid_ids, id]
    setD((x) => ({ ...x, kid_ids: next, assign_all: next.length === 0 }))
  }
  const toggleDay = (day: Weekday) => {
    setCustomDays(true)
    set('days', d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day].sort())
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    await onSave({ ...d, name, description: d.description.trim() })
    setBusy(false)
  }

  return (
    <Modal
      title={`${d.id ? 'Modifier la' : 'Nouvelle'} mission`}
      onClose={onCancel}
      wide
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" form="task-form" className="btn" disabled={!valid || busy}>{busy ? '…' : 'Enregistrer'}</button>
      </>}
    >
      <form id="task-form" className="form" onSubmit={submit}>
        <div className="segmented segmented--full" role="radiogroup" aria-label="Type de mission">
          <button type="button" role="radio" aria-checked={planned} className={planned ? 'is-on' : ''} onClick={() => set('kind', 'planned')}>
            🗓️ Planifiée
          </button>
          <button type="button" role="radio" aria-checked={!planned} className={!planned ? 'is-on' : ''} onClick={() => set('kind', 'bonus')}>
            ✨ Bonus
          </button>
        </div>
        <p className="form__hint">
          {planned ? 'Apparaît dans la journée des enfants, aux jours et au moment choisis.' : 'Mission en plus, faisable une fois par jour, quand ils veulent.'}
        </p>

        <div className="form__row">
          <EmojiField value={d.emoji} onChange={(e) => set('emoji', e)} />
          <label className="field field--grow">
            <span className="field__label">Nom</span>
            <input value={d.name} maxLength={40} onChange={(e) => set('name', e.target.value)} placeholder="Faire son lit" autoFocus required />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Description <span className="field__hint">(optionnel · {d.description.length}/120)</span></span>
          <textarea value={d.description} maxLength={120} rows={2} onChange={(e) => set('description', e.target.value)} placeholder="Couette bien tirée, pyjama rangé" />
        </label>

        <fieldset className="field">
          <legend className="field__label">Pour qui ?</legend>
          <div className="chips">
            <Pill on={d.assign_all} onClick={() => setD((x) => ({ ...x, assign_all: true, kid_ids: [] }))}>👨‍👩‍👧‍👦 Tous les enfants</Pill>
            {kids.map((k) => (
              <Pill key={k.id} on={!d.assign_all && d.kid_ids.includes(k.id)} onClick={() => toggleKid(k.id)} className={`c-${k.color}`}>
                {k.emoji} {k.name}
              </Pill>
            ))}
          </div>
          {kids.length === 0 && <p className="form__hint">Ajoute tes enfants dans l'onglet 👧 Enfants.</p>}
        </fieldset>

        {planned && (
          <div className="plan-box">
            <fieldset className="field">
              <legend className="field__label">Quels jours ?</legend>
              <div className="chips">
                {DAY_PRESETS.map((p) => (
                  <Pill key={p.id} on={p.id === 'custom' ? customDays : !customDays && preset === p.id}
                    onClick={() => {
                      if (p.days) { setCustomDays(false); set('days', p.days) } else setCustomDays(true)
                    }}>
                    {p.label}
                  </Pill>
                ))}
              </div>
              {customDays && (
                <div className="chips chips--days">
                  {WEEKDAYS.map((w) => (
                    <Pill key={w.value} on={d.days.includes(w.value)} onClick={() => toggleDay(w.value)} label={w.label} className="chip--day">{w.short}</Pill>
                  ))}
                </div>
              )}
              {!daysOk && <p className="form__error">Choisis au moins un jour</p>}
            </fieldset>

            <fieldset className="field">
              <legend className="field__label">À quel moment ?</legend>
              <div className="chips">
                {SLOTS.map((s) => (
                  <Pill key={s.value} on={effectiveSlot === s.value} onClick={() => setD((x) => ({ ...x, slot: s.value, at_time: '' }))}>
                    {s.emoji} {s.label}
                  </Pill>
                ))}
              </div>
            </fieldset>

            <label className="field field--time">
              <span className="field__label">Heure précise <span className="field__hint">(optionnel)</span></span>
              <div className="time-row">
                <input type="time" value={d.at_time} onChange={(e) => set('at_time', e.target.value)} aria-label="Heure précise" />
                {d.at_time && <button type="button" className="btn btn--ghost btn--small" onClick={() => set('at_time', '')}>Sans heure</button>}
              </div>
            </label>
          </div>
        )}

        <div className="form__row">
          <Stepper label="Points gagnés 🪙" value={d.points} min={1} max={999} onChange={(v) => set('points', v)} />
          <label className="field field--grow">
            <span className="field__label">Catégorie</span>
            <select value={d.category_id} onChange={(e) => set('category_id', e.target.value)} required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </label>
        </div>

        <div className="team-box">
          <label className="field field--inline">
            <span className="switch">
              <input type="checkbox" checked={d.team !== null} onChange={(e) => set('team', e.target.checked ? Math.max(d.points + 1, 2) : null)} aria-label="Bonus d'équipe" />
              <span className="switch__track" />
            </span>
            <span>👫 Bonus d'équipe</span>
          </label>
          {d.team !== null && (
            <div className="team-box__body">
              <Stepper label="Points pour chacun si tous le font 🪙" value={d.team} min={d.points + 1} max={999} onChange={(v) => set('team', v)} ariaLabel="Points d'équipe" />
              <p className={`team-box__hint ${teamOk ? '' : 'is-error'}`}>
                {teamOk ? <>Seul : ★ {d.points} · Tous ensemble : ★ {d.team} chacun</> : <>Doit être plus grand que les points en solo (★ {d.points})</>}
              </p>
            </div>
          )}
        </div>

        <label className="field field--inline">
          <Switch checked={d.needs_approval} onChange={(v) => set('needs_approval', v)} label="Un parent doit valider" />
          <span>🔐 Un parent doit valider</span>
        </label>
        <label className="field field--inline">
          <Switch checked={d.active} onChange={(v) => set('active', v)} label="Visible" />
          <span>{d.active ? 'Visible pour les enfants' : 'Masquée pour les enfants'}</span>
        </label>
      </form>
    </Modal>
  )
}
