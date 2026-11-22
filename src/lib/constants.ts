import type { ColorToken, Slot, Weekday } from './types'

export const SLOTS: { value: Slot; label: string; emoji: string; from: number; to: number }[] = [
  { value: 'morning', label: 'Matin', emoji: '🌅', from: 0, to: 12 * 60 },
  { value: 'noon', label: 'Midi', emoji: '☀️', from: 12 * 60, to: 14 * 60 },
  { value: 'afternoon', label: 'Après-midi', emoji: '🌤️', from: 14 * 60, to: 18 * 60 },
  { value: 'evening', label: 'Soir', emoji: '🌙', from: 18 * 60, to: 24 * 60 },
  { value: 'anytime', label: "N'importe quand", emoji: '✨', from: 0, to: 24 * 60 },
]
export const slotInfo = (s: Slot) => SLOTS.find((x) => x.value === s)!

/** Slot for a given local time ("HH:MM"), mirroring kids_rewards._slot_for. */
export function slotForTime(hhmm: string | null, fallback: Slot): Slot {
  if (!hhmm) return fallback
  const [h, m] = hhmm.split(':').map(Number)
  const min = h * 60 + m
  return SLOTS.find((s) => s.value !== 'anytime' && min >= s.from && min < s.to)?.value ?? fallback
}

export const WEEKDAYS: { value: Weekday; short: string; label: string }[] = [
  { value: 1, short: 'L', label: 'Lundi' },
  { value: 2, short: 'M', label: 'Mardi' },
  { value: 3, short: 'M', label: 'Mercredi' },
  { value: 4, short: 'J', label: 'Jeudi' },
  { value: 5, short: 'V', label: 'Vendredi' },
  { value: 6, short: 'S', label: 'Samedi' },
  { value: 7, short: 'D', label: 'Dimanche' },
]

export const DAY_PRESETS: { id: 'all' | 'weekdays' | 'weekend' | 'custom'; label: string; days: Weekday[] | null }[] = [
  { id: 'all', label: 'Tous les jours', days: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'weekdays', label: 'Semaine (L–V)', days: [1, 2, 3, 4, 5] },
  { id: 'weekend', label: 'Week-end', days: [6, 7] },
  { id: 'custom', label: 'Choisir', days: null },
]

export function daysPreset(days: Weekday[] | null): (typeof DAY_PRESETS)[number]['id'] {
  const key = (days ?? []).slice().sort().join(',')
  return DAY_PRESETS.find((p) => p.days && p.days.join(',') === key)?.id ?? 'custom'
}

export function daysSummary(days: Weekday[] | null): string {
  const p = daysPreset(days)
  if (p !== 'custom') return DAY_PRESETS.find((x) => x.id === p)!.label
  return (days ?? []).slice().sort().map((d) => WEEKDAYS[d - 1].label.slice(0, 3)).join(' ')
}

export const COLORS: { value: ColorToken; label: string }[] = [
  { value: 'pink', label: 'Rose' },
  { value: 'peach', label: 'Pêche' },
  { value: 'yellow', label: 'Jaune' },
  { value: 'mint', label: 'Menthe' },
  { value: 'sky', label: 'Ciel' },
  { value: 'blue', label: 'Bleu' },
  { value: 'lavender', label: 'Lavande' },
  { value: 'grey', label: 'Gris' },
]

export const IDLE_LOCK_MS = 5 * 60 * 1000
export const KID_SPACE_IDLE_MS = 2 * 60 * 1000
export const UNDO_MS = 5000
export const PIN_LENGTH = 4
