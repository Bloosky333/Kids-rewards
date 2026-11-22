import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '../../components/Modal'
import { addPlannedItems, fetchWeekPlan, removePlannedItem } from '../../lib/api'
import { SLOTS, slotInfo } from '../../lib/constants'
import { addDays, formatDay, mondayOf } from '../../lib/dates'
import { qk, useBoard } from '../../lib/queries'
import type { Kid, Slot, Task } from '../../lib/types'
import { Pill } from './fields'
import { useAdminAction } from './useAdmin'

export function WeekPlan({ kids, tasks, onClose }: { kids: Kid[]; tasks: Task[]; onClose: () => void }) {
  const today = useBoard('today').data?.today
  const [kidId, setKidId] = useState(kids[0]?.id ?? '')
  const [offset, setOffset] = useState(0)
  const [adding, setAdding] = useState(false)
  const run = useAdminAction()
  const from = today ? addDays(mondayOf(today), offset * 7) : null
  const week = useQuery({
    queryKey: qk.week(kidId, from ?? ''),
    queryFn: () => fetchWeekPlan(kidId, from!),
    enabled: !!kidId && !!from,
  })

  return (
    <Modal title="📅 Planning de la semaine" onClose={onClose} wide>
      <div className="chips">
        {kids.map((k) => (
          <Pill key={k.id} on={k.id === kidId} onClick={() => setKidId(k.id)} className={`c-${k.color}`}>{k.emoji} {k.name}</Pill>
        ))}
      </div>
      <div className="weeknav">
        <button className="icon-btn" onClick={() => setOffset((o) => o - 1)} aria-label="Semaine précédente">◀</button>
        <span className="weeknav__label">{from ? `Semaine du ${formatDay(from, { day: 'numeric', month: 'long' })}` : '…'}</span>
        <button className="icon-btn" onClick={() => setOffset((o) => o + 1)} aria-label="Semaine suivante">▶</button>
        <button className="btn btn--small" onClick={() => setAdding(true)} disabled={!today}>➕ Ajouter pour un jour</button>
      </div>
      {week.isPending && <p className="muted">Chargement…</p>}
      <div className="week">
        {(week.data ?? []).map((day) => (
          <div key={day.date} className={`week__day ${day.date === today ? 'is-today' : ''}`}>
            <h3 className="week__date">{formatDay(day.date, { weekday: 'short', day: 'numeric' })}</h3>
            {day.items.length === 0 && <p className="week__empty">—</p>}
            {day.items.map((it) => (
              <div key={it.task_id} className={`week__item ${it.one_off ? 'is-oneoff' : ''}`}>
                <span aria-hidden="true">{slotInfo(it.slot).emoji}</span>
                <span className="week__name">{it.emoji} {it.name}{it.at_time && <small> {it.at_time}</small>}</span>
                {it.one_off && it.planned_item_id && (
                  <button className="week__remove" aria-label={`Retirer ${it.name} du ${day.date}`}
                    onClick={() => run((pin) => removePlannedItem(pin, it.planned_item_id!), 'Retiré ✅')}>✕</button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="form__hint">Les missions avec ✕ ont été ajoutées pour un jour précis. Les autres viennent du planning de la mission.</p>
      {adding && today && (
        <AddOneOff kids={kids} tasks={tasks} defaultKid={kidId} today={today} onClose={() => setAdding(false)}
          onAdded={(date, kidIds) => {
            // jump to the week (and kid) that was just planned so the new item is visible
            const weeks = Math.round((Date.parse(mondayOf(date)) - Date.parse(mondayOf(today))) / (7 * 86400000))
            setOffset(weeks)
            if (!kidIds.includes(kidId)) setKidId(kidIds[0])
          }} />
      )}
    </Modal>
  )
}

function AddOneOff({ kids, tasks, defaultKid, today, onClose, onAdded }: {
  kids: Kid[]; tasks: Task[]; defaultKid: string; today: string; onClose: () => void; onAdded: (date: string, kidIds: string[]) => void
}) {
  const run = useAdminAction()
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '')
  const [kidIds, setKidIds] = useState<string[]>(defaultKid ? [defaultKid] : [])
  const [date, setDate] = useState(addDays(today, 1))
  const [slot, setSlot] = useState<Slot>('anytime')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const valid = !!taskId && kidIds.length > 0 && !!date

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const res = await run((pin) => addPlannedItems(pin, taskId, kidIds, date, slot, time || null), 'Ajouté au planning ✅')
    setBusy(false)
    if (res.ok) {
      onAdded(date, kidIds)
      onClose()
    }
  }

  return (
    <Modal
      title="➕ Ajouter une mission pour un jour"
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Annuler</button>
        <button type="submit" form="oneoff-form" className="btn" disabled={!valid || busy}>Ajouter</button>
      </>}
    >
      <form id="oneoff-form" className="form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Mission</span>
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
          </select>
        </label>
        <fieldset className="field">
          <legend className="field__label">Pour qui ?</legend>
          <div className="chips">
            {kids.map((k) => (
              <Pill key={k.id} on={kidIds.includes(k.id)} className={`c-${k.color}`}
                onClick={() => setKidIds((ids) => ids.includes(k.id) ? ids.filter((i) => i !== k.id) : [...ids, k.id])}>
                {k.emoji} {k.name}
              </Pill>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span className="field__label">Jour</span>
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Jour" />
        </label>
        <fieldset className="field">
          <legend className="field__label">Moment</legend>
          <div className="chips">
            {SLOTS.map((s) => <Pill key={s.value} on={!time && slot === s.value} onClick={() => { setSlot(s.value); setTime('') }}>{s.emoji} {s.label}</Pill>)}
          </div>
        </fieldset>
        <label className="field field--time">
          <span className="field__label">Heure précise <span className="field__hint">(optionnel)</span></span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Heure précise" />
        </label>
      </form>
    </Modal>
  )
}
