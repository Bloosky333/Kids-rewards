import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'success' | 'error' | 'info'
interface ToastItem { id: number; message: string; kind: Kind }
const Ctx = createContext<(message: string, kind?: Kind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const show = useCallback((message: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs.slice(-1), { id, message, kind }])
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 4500 : 2500)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>{t.message}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
