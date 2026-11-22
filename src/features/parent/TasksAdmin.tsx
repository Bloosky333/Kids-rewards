import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminListKids, adminListTasks, archiveTask, saveTask } from '../../lib/api'
import { daysSummary, slotInfo } from '../../lib/constants'
import { hhmm } from '../../lib/dates'
import { groupByCategory } from '../../lib/grouping'
import { qk, useCategories } from '../../lib/queries'
import type { Kid, Task } from '../../lib/types'
import { ConfirmDialog } from '../../components/Modal'
import { PointsBadge, TeamBadge } from '../../components/PointsBadge'
import { Switch } from './fields'
import { TaskForm, type TaskDraft } from './TaskForm'
import { WeekPlan } from './WeekPlan'
import { useAdminAction, useAdminQueryFn } from './useAdmin'

const toDraft = (t: Task): TaskDraft => ({
  id: t.id, name: t.name, emoji: t.emoji, points: t.points, category_id: t.category_id, active: t.active,
  description: t.description ?? '', team: t.team_points, kind: t.kind, assign_all: t.assign_all, kid_ids: t.kid_ids ?? [],
  days: t.days ?? [1, 2, 3, 4, 5, 6, 7], slot: t.slot, at_time: hhmm(t.at_time) ?? '', needs_approval: t.needs_approval,
})

const BANNER_KEY = 'kr-v2-plan-check-dismissed'
const readDismissed = () => { try { return localStorage.getItem(BANNER_KEY) === '1' } catch { return false } }

export function useAdminKids() {
  const fn = useAdminQueryFn<Kid[]>(adminListKids)
  return useQuery({ queryKey: qk.adminKids, queryFn: fn, staleTime: 0 })
}

export function TasksAdmin() {
  const run = useAdminAction()
  const cats = useCategories()
  const kids = useAdminKids()
  const listFn = useAdminQueryFn<Task[]>(adminListTasks)
  const tasks = useQuery({ queryKey: qk.adminTasks, queryFn: listFn, staleTime: 0 })
  const [editing, setEditing] = useState<TaskDraft | null>(null)
  const [archiving, setArchiving] = useState<Task | null>(null)
  const [week, setWeek] = useState(false)
  const [dismissed, setDismissed] = useState(readDismissed)

  const taskCats = (cats.data ?? []).filter((c) => c.kind === 'task')
  const activeKids = (kids.data ?? []).filter((k) => k.active)
  const kidById = new Map((kids.data ?? []).map((k) => [k.id, k]))
  const groups = groupByCategory(cats.data ?? [], 'task', tasks.data ?? [])

  const save = async (d: TaskDraft) => {
    const res = await run((pin) => saveTask(pin, {
      id: d.id, name: d.name, emoji: d.emoji, points: d.points, category_id: d.category_id, active: d.active,
      description: d.description || null, team_points: d.team, kind: d.kind, assign_all: d.assign_all,
      kid_ids: d.assign_all ? [] : d.kid_ids, days: d.kind === 'planned' ? d.days : null, slot: d.slot,
      at_time: d.kind === 'planned' && d.at_time ? d.at_time : null, needs_approval: d.needs_approval,
    }), d.id ? 'Modifié ✅' : 'Ajouté ✅')
    if (res.ok) setEditing(null)
  }

  const newDraft = (): TaskDraft => ({
    id: null, name: '', emoji: '', points: 1, category_id: taskCats[0]?.id ?? '', active: true, description: '', team: null,
    kind: 'planned', assign_all: true, kid_ids: [], days: [1, 2, 3, 4, 5, 6, 7], slot: 'anytime', at_time: '', needs_approval: false,
  })

  const who = (t: Task) => t.assign_all ? 'Tous' : t.kid_ids.map((id) => kidById.get(id)?.emoji ?? '❔').join(' ')

  return (
    <section>
      <div className="admin-head">
        <h1>🎯 Missions</h1>
        <div className="admin-head__actions">
          <button className="btn btn--ghost" onClick={() => setWeek(true)} disabled={activeKids.length === 0}>📅 Planning de la semaine</button>
          <button className="btn" onClick={() => setEditing(newDraft())} disabled={taskCats.length === 0}>➕ Nouvelle mission</button>
        </div>
      </div>

      {!dismissed && (tasks.data?.length ?? 0) > 0 && (
        <p className="banner banner--info banner--dismiss">
          <span>🗓️ Nouveau : les missions ont un planning. Vérifie les jours, moments et enfants de chaque mission.</span>
          <button className="icon-btn" aria-label="Masquer" onClick={() => {
            setDismissed(true)
            try { localStorage.setItem(BANNER_KEY, '1') } catch { /* private mode */ }
          }}>✕</button>
        </p>
      )}
      {kids.isSuccess && activeKids.length === 0 && (
        <p className="banner banner--info">Ajoute d'abord tes enfants dans <Link to="/parent/enfants">👧 Enfants</Link> pour voir leur journée.</p>
      )}
      {cats.isSuccess && taskCats.length === 0 && (
        <p className="banner banner--info">Crée d'abord une catégorie de missions dans <Link to="/parent/categories">🗂️ Catégories</Link>.</p>
      )}
      {tasks.isPending && <p className="muted">Chargement…</p>}
      {tasks.isError && <p className="banner banner--warn">{(tasks.error as Error).message}</p>}

      {groups.map((g) => (
        <section key={g.category.id} className={`admin-group c-${g.category.color}`}>
          <h2 className="admin-group__title">{g.category.emoji} {g.category.name}</h2>
          <ul className="rows">
            {g.items.map((t) => (
              <li key={t.id} className={`row ${t.active ? '' : 'row--inactive'}`}>
                <span className="row__emoji" aria-hidden="true">{t.emoji}</span>
                <span className="row__main">
                  <span className="row__name">{t.name}</span>
                  {t.description && <span className="row__desc">{t.description}</span>}
                  <span className="row__meta">
                    <PointsBadge value={t.points} size="sm" />
                    {t.team_points !== null && <TeamBadge value={t.team_points} size="sm" />}
                    <span className={`sched sched--${t.kind}`}>
                      {t.kind === 'planned'
                        ? <>🗓️ {daysSummary(t.days)} · {slotInfo(t.slot).emoji} {hhmm(t.at_time) ?? slotInfo(t.slot).label}</>
                        : <>✨ Bonus</>}
                      {' · '}{who(t)}
                    </span>
                    {t.needs_approval && <span className="tag">🔐 À valider</span>}
                    {!t.active && <span className="tag">Masquée</span>}
                  </span>
                </span>
                <span className="row__actions">
                  <Switch checked={t.active} onChange={() => save({ ...toDraft(t), active: !t.active })} label={`${t.name} visible`} />
                  <button className="icon-btn" aria-label={`Modifier ${t.name}`} onClick={() => setEditing(toDraft(t))}>✏️</button>
                  <button className="icon-btn" aria-label={`Supprimer ${t.name}`} onClick={() => setArchiving(t)}>🗑️</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && <TaskForm draft={editing} categories={taskCats} kids={activeKids} onCancel={() => setEditing(null)} onSave={save} />}
      {archiving && (
        <ConfirmDialog
          title="Supprimer cette mission ?"
          message={<>« {archiving.emoji} {archiving.name} » disparaîtra du planning. Les jours passés gardent leur historique.</>}
          onCancel={() => setArchiving(null)}
          onConfirm={async () => {
            const id = archiving.id
            const res = await run((pin) => archiveTask(pin, id), 'Supprimée 🗑️')
            if (res.ok || res.error === 'not_found') setArchiving(null)
          }}
        />
      )}
      {week && <WeekPlan kids={activeKids} tasks={(tasks.data ?? []).filter((t) => t.active)} onClose={() => setWeek(false)} />}
    </section>
  )
}
