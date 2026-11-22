import type { ReactNode } from 'react'

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <span className="switch" title={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="switch__track" />
    </span>
  )
}

export function Stepper({ label, value, min, max, onChange, ariaLabel }: {
  label: ReactNode; value: number; min: number; max: number; onChange: (v: number) => void; ariaLabel?: string
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <div className="stepper">
        <button type="button" onClick={() => onChange(Math.max(min, (value || 0) - 1))} aria-label={`Moins${ariaLabel ? ` (${ariaLabel})` : ''}`}>−</button>
        <input
          type="number" inputMode="numeric" min={min} max={max}
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          aria-label={ariaLabel}
        />
        <button type="button" onClick={() => onChange(Math.min(max, (value || 0) + 1))} aria-label={`Plus${ariaLabel ? ` (${ariaLabel})` : ''}`}>+</button>
      </div>
    </label>
  )
}

/** Toggleable pill used for days, slots, kids… */
export function Pill({ on, onClick, children, label, className = '' }: { on: boolean; onClick: () => void; children: ReactNode; label?: string; className?: string }) {
  return (
    <button type="button" className={`chip ${on ? 'is-on' : ''} ${className}`} aria-pressed={on} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}
