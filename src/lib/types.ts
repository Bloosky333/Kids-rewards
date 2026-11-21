export type CategoryKind = 'task' | 'reward'
export type Frequency = 'daily' | 'weekly' | 'anytime' | 'once'
export type ColorToken = 'pink' | 'peach' | 'yellow' | 'mint' | 'sky' | 'blue' | 'lavender' | 'grey'

export interface Category {
  id: string
  kind: CategoryKind
  name: string
  emoji: string
  color: ColorToken
  sort_order: number
}

export interface Task {
  id: string
  name: string
  emoji: string
  points: number
  category_id: string
  frequency: Frequency
  active: boolean
  /** Short explanation shown under the name (≤120 chars). */
  description: string | null
  /** Points EACH kid gets when all kids complete the task together; null = no team bonus. */
  team_points: number | null
}

export interface Reward {
  id: string
  name: string
  emoji: string
  cost: number
  category_id: string
  active: boolean
}

export type RpcError =
  | 'invalid_pin'
  | 'locked'
  | 'not_set'
  | 'already_set'
  | 'invalid_format'
  | 'invalid_input'
  | 'invalid_category'
  | 'duplicate_name'
  | 'category_not_empty'
  | 'not_found'
  | 'network'

export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RpcError; retry_after?: number; count?: number }
