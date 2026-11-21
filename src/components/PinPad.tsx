import { useEffect, useState, type ReactNode } from 'react'
import { PIN_LENGTH } from '../lib/constants'

interface Props {
  title: string
  subtitle?: ReactNode
  /** Called once PIN_LENGTH digits are entered. Return false (or a promise of false) to clear + shake. */
  onComplete: (code: string) => boolean | void | Promise<boolean | void>
  error?: string | null
  disabled?: boolean
  footer?: ReactNode
}

export function PinPad({ title, subtitle, onComplete, error, disabled, footer }: Props) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  const press = (d: string) => {
    if (disabled || busy) return
    setCode((c) => (c.length < PIN_LENGTH ? c + d : c))
  }
  const back = () => !busy && setCode((c) => c.slice(0, -1))

  useEffect(() => {
    if (code.length !== PIN_LENGTH) return
    let cancelled = false
    setBusy(true)
    Promise.resolve(onComplete(code)).then((res) => {
      if (cancelled) return
      setBusy(false)
      setCode('')
      if (res === false) setShake((s) => s + 1)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // Physical keyboard support (handy on desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  return (
    <div className="pinpad">
      <h2 className="pinpad__title">{title}</h2>
      {subtitle && <p className="pinpad__subtitle">{subtitle}</p>}
      <div key={shake} className={`pinpad__dots ${shake ? 'shake' : ''}`} aria-label={`${code.length} chiffres saisis`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`pinpad__dot ${i < code.length ? 'is-filled' : ''}`} />
        ))}
      </div>
      <p className="pinpad__error" role="alert">{error ?? ' '}</p>
      <div className="pinpad__keys">
        {keys.map((k) => (
          <button key={k} className="pinpad__key" onClick={() => press(k)} disabled={disabled || busy}>{k}</button>
        ))}
        <span />
        <button className="pinpad__key" onClick={() => press('0')} disabled={disabled || busy}>0</button>
        <button className="pinpad__key pinpad__key--muted" onClick={back} disabled={disabled || busy || !code} aria-label="Effacer">⌫</button>
      </div>
      {footer && <div className="pinpad__footer">{footer}</div>}
    </div>
  )
}
