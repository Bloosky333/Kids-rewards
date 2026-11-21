import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { IDLE_LOCK_MS } from '../../lib/constants'

interface ParentSession {
  /** The parent PIN, held in memory only while unlocked. */
  pin: string | null
  unlock: (pin: string) => void
  lock: () => void
  setPin: (pin: string) => void
}

const Ctx = createContext<ParentSession | null>(null)

export function ParentSessionProvider({ children }: { children: ReactNode }) {
  const [pin, setPinState] = useState<string | null>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const timer = useRef<number | undefined>(undefined)

  const lock = useCallback(() => {
    setPinState(null)
    qc.removeQueries({ queryKey: ['admin'] })
    navigate('/', { replace: true })
  }, [navigate, qc])

  const unlock = useCallback((p: string) => setPinState(p), [])

  // Auto-lock after IDLE_LOCK_MS without any interaction.
  useEffect(() => {
    if (!pin) return
    const reset = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(lock, IDLE_LOCK_MS)
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true, capture: true }))
    reset()
    return () => {
      window.clearTimeout(timer.current)
      events.forEach((e) => window.removeEventListener(e, reset, { capture: true }))
    }
  }, [pin, lock])

  const value = useMemo(() => ({ pin, unlock, lock, setPin: setPinState }), [pin, unlock, lock])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useParentSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useParentSession outside provider')
  return v
}
