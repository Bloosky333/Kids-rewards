import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { completeTask, errorMessage, setCompletion, uncompleteTask } from '../../lib/api'
import { bigCelebration, burstFrom, floatPoints } from '../../lib/celebrate'
import { UNDO_MS } from '../../lib/constants'
import type { Board, BoardKid } from '../../lib/types'
import { useToast } from '../../components/Toast'
import { useParentSession } from '../parent/ParentSession'

type Tickable = { task_id: string; status: string | null; approved_by_parent: boolean; points: number; team_points: number | null; name: string }

/**
 * Tick / untick logic shared by the board and the kid space.
 * - today: kids tick freely (server checks), 5 s undo window, celebration.
 * - other days: only an unlocked parent can fix (set_completion).
 */
export function useTick(board: Board | undefined) {
  const qc = useQueryClient()
  const toast = useToast()
  const { pin } = useParentSession()
  const [undoable, setUndoable] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const timers = useRef<Record<string, number>>({})

  const refresh = useCallback(
    () => Promise.all([qc.invalidateQueries({ queryKey: ['public', 'board'] }), qc.invalidateQueries({ queryKey: ['public', 'pending-count'] }), qc.invalidateQueries({ queryKey: ['admin', 'pending'] })]),
    [qc],
  )

  const key = (kidId: string, taskId: string) => `${kidId}:${taskId}`

  const markUndoable = (k: string) => {
    window.clearTimeout(timers.current[k])
    setUndoable((u) => ({ ...u, [k]: Date.now() }))
    timers.current[k] = window.setTimeout(() => setUndoable((u) => {
      const { [k]: _drop, ...rest } = u
      return rest
    }), UNDO_MS)
  }

  /** Returns 'confirm-untick' when the caller should ask before unticking. */
  const toggle = useCallback(
    async (kid: BoardKid, item: Tickable, el: Element | null): Promise<'confirm-untick' | void> => {
      if (!board) return
      const k = key(kid.id, item.task_id)
      if (busy === k) return

      // Not today: parent fix only.
      if (!board.is_today) {
        if (!pin) {
          toast("Tu peux cocher seulement aujourd'hui 🙂", 'info')
          return
        }
        setBusy(k)
        const res = await setCompletion(pin, kid.id, item.task_id, board.date, !item.status)
        setBusy(null)
        if (!res.ok) toast(errorMessage(res), 'error')
        await refresh()
        return
      }

      if (item.status) {
        if (item.approved_by_parent && !pin) {
          toast('Déjà validé par un parent 🔒', 'info')
          return
        }
        if (!undoable[k]) return 'confirm-untick'
        await untick(kid, item)
        return
      }

      setBusy(k)
      const res = await completeTask(kid.id, item.task_id)
      setBusy(null)
      if (!res.ok) {
        toast(errorMessage(res), res.error === 'already_done' ? 'info' : 'error')
        await refresh()
        return
      }
      burstFrom(el)
      floatPoints(el, res.data.status === 'pending' ? `⏳ +${res.data.earned} ★` : `+${res.data.earned} ★`)
      if (res.data.team_completed) toast('👫 Bonus d’équipe ! Tout le monde gagne plus ★', 'success')
      if (res.data.status === 'pending') toast('Bravo ! Un parent va valider ⏳', 'info')
      markUndoable(k)
      const plannedLeft = kid.items.filter((i) => !i.status && i.task_id !== item.task_id).length
      if (kid.items.some((i) => i.task_id === item.task_id) && plannedLeft === 0) {
        window.setTimeout(bigCelebration, 250)
        toast(`Bravo ${kid.name}, journée terminée ! 🎉`, 'success')
      }
      await refresh()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, pin, busy, undoable, refresh, toast],
  )

  const untick = useCallback(
    async (kid: BoardKid, item: Tickable) => {
      if (!board) return
      const k = key(kid.id, item.task_id)
      setBusy(k)
      const res = pin && item.approved_by_parent
        ? await setCompletion(pin, kid.id, item.task_id, board.date, false)
        : await uncompleteTask(kid.id, item.task_id)
      setBusy(null)
      setUndoable((u) => {
        const { [k]: _drop, ...rest } = u
        return rest
      })
      if (!res.ok) toast(errorMessage(res), 'error')
      await refresh()
    },
    [board, pin, refresh, toast],
  )

  return { toggle, untick, isUndoable: (kidId: string, taskId: string) => !!undoable[key(kidId, taskId)], busy }
}
