import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage, isAuthError } from '../../lib/api'
import type { RpcResult } from '../../lib/types'
import { useToast } from '../../components/Toast'
import { useParentSession } from './ParentSession'

/**
 * Runs an admin RPC with the in-memory PIN. Handles errors uniformly:
 * auth errors lock parent mode, others show a toast. On success, refreshes all lists.
 */
export function useAdminAction() {
  const { pin, lock } = useParentSession()
  const toast = useToast()
  const qc = useQueryClient()

  return useCallback(
    async <T,>(call: (pin: string) => Promise<RpcResult<T>>, success?: string): Promise<RpcResult<T>> => {
      if (!pin) {
        lock()
        return { ok: false, error: 'not_set' }
      }
      const res = await call(pin)
      if (res.ok) {
        if (success) toast(success, 'success')
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['public'] }),
          qc.invalidateQueries({ queryKey: ['admin'] }),
        ])
      } else if (isAuthError(res.error)) {
        toast('Mode parent verrouillé 🔒 ' + errorMessage(res), 'error')
        lock()
      } else {
        toast(errorMessage(res), 'error')
      }
      return res
    },
    [pin, lock, toast, qc],
  )
}

/** Throwing variant for useQuery: unwraps admin list RPCs, locks on auth errors. */
export function useAdminQueryFn<T>(call: (pin: string) => Promise<RpcResult<T>>) {
  const { pin, lock } = useParentSession()
  return async () => {
    if (!pin) throw new Error('locked')
    const res = await call(pin)
    if (res.ok) return res.data
    if (isAuthError(res.error)) lock()
    throw new Error(errorMessage(res))
  }
}
