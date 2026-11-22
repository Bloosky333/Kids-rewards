import { SLOTS } from '../../lib/constants'
import { nowMinutes } from '../../lib/dates'
import type { BoardItem, Slot } from '../../lib/types'

/** Items grouped by slot in display order (anytime last); empty slots dropped. */
export function groupBySlot<T extends Pick<BoardItem, 'slot'>>(items: T[]): { slot: Slot; items: T[] }[] {
  return SLOTS.map((s) => ({ slot: s.value, items: items.filter((i) => i.slot === s.value) })).filter((g) => g.items.length > 0)
}

/** Slot the household is in right now (local clock, display only). */
export function currentSlot(): Slot {
  const m = nowMinutes()
  return SLOTS.find((s) => s.value !== 'anytime' && m >= s.from && m < s.to)?.value ?? 'evening'
}

/** Past = its time window is over (only meaningful today). */
export function isPastSlot(slot: Slot): boolean {
  if (slot === 'anytime') return false
  const s = SLOTS.find((x) => x.value === slot)!
  return nowMinutes() >= s.to
}
