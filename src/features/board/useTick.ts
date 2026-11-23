import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { completeTask, errorMessage, setCompletion, uncompleteTask } from '../../lib/api'
import { bigCelebration, burstFrom, floatPoints } from '../../lib/celebrate'
import type { Board, BoardKid } from '../../lib/types'
import { useToast } from '../../components/Toast'
import { useParentSession } from '../parent/ParentSession'

type Tickable = { task_id: string; status: string | null; name: string }

/**
 * One tap = toggle. Today: anyone can tick / untick (celebration on tick).
 * Other days: only an unlocked parent can fix (set_completion).
 */
export function useTick(board: Board | undefined) {
  const qc = useQueryClient()
  const toast = useToast()
  const { pin } = useParentSession()
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['public', 'board'] }), [qc])

  const toggle = useCallback(
    async (kid: BoardKid, item: Tickable, el: Element | null) => {
      if (!board) return
      const k = `${kid.id}:${item.task_id}`
      if (busy === k) return

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

      setBusy(k)
      if (item.status) {
        const res = await uncompleteTask(kid.id, item.task_id)
        setBusy(null)
        if (!res.ok && res.error !== 'not_found') toast(errorMessage(res), 'error')
        await refresh()
        return
      }

      const res = await completeTask(kid.id, item.task_id)
      setBusy(null)
      if (!res.ok) {
        if (res.error !== 'already_done') toast(errorMessage(res), 'error')
        await refresh()
        return
      }
      burstFrom(el)
      floatPoints(el, `+${res.data.earned} ★`)
      if (res.data.team_completed) toast('👫 Bonus d’équipe ! Tout le monde gagne plus ★', 'success')
      const isPlanned = kid.items.some((i) => i.task_id === item.task_id)
      if (isPlanned && kid.items.every((i) => i.task_id === item.task_id || i.status)) {
        window.setTimeout(bigCelebration, 250)
        toast(`Bravo ${kid.name}, journée terminée ! 🎉`, 'success')
      }
      await refresh()
    },
    [board, pin, busy, refresh, toast],
  )

  return { toggle, busy }
}
