import type { ColorToken, Frequency } from './types'

export const FREQUENCIES: { value: Frequency; label: string; emoji: string }[] = [
  { value: 'daily', label: 'Chaque jour', emoji: '☀️' },
  { value: 'weekly', label: 'Chaque semaine', emoji: '📅' },
  { value: 'anytime', label: 'Quand tu veux', emoji: '✨' },
  { value: 'once', label: 'Une fois', emoji: '1️⃣' },
]

export const frequencyLabel = (f: Frequency) => FREQUENCIES.find((x) => x.value === f)!

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
export const PIN_LENGTH = 4
