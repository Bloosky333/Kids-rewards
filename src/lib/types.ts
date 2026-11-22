export type CategoryKind = 'task' | 'reward'
export type ColorToken = 'pink' | 'peach' | 'yellow' | 'mint' | 'sky' | 'blue' | 'lavender' | 'grey'
export type Slot = 'morning' | 'noon' | 'afternoon' | 'evening' | 'anytime'
export type TaskKind = 'planned' | 'bonus'
/** ISO weekday: 1 = Monday … 7 = Sunday */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface Category {
  id: string
  kind: CategoryKind
  name: string
  emoji: string
  color: ColorToken
  sort_order: number
}

export interface Kid {
  id: string
  name: string
  emoji: string
  color: ColorToken
  sort_order: number
  active: boolean
}

export interface Task {
  id: string
  name: string
  emoji: string
  points: number
  category_id: string
  active: boolean
  /** Short explanation shown under the name (≤120 chars). */
  description: string | null
  /** Points EACH kid gets when all kids complete the task together; null = no team bonus. */
  team_points: number | null
  kind: TaskKind
  assign_all: boolean
  kid_ids: string[]
  days: Weekday[] | null
  slot: Slot
  /** "HH:MM[:SS]" or null */
  at_time: string | null
  needs_approval: boolean
}

export interface Reward {
  id: string
  name: string
  emoji: string
  cost: number
  category_id: string
  active: boolean
}

// ---------- day board ----------

export type CompletionStatus = 'pending' | 'approved'

export interface BoardItem {
  task_id: string
  name: string
  emoji: string
  description: string | null
  points: number
  team_points: number | null
  needs_approval: boolean
  slot: Slot
  at_time: string | null
  one_off: boolean
  status: CompletionStatus | null
  approved_by_parent: boolean
  team_applies: boolean
  team_size: number
  team_done: number
  earned: number
}

export type BonusItem = Omit<BoardItem, 'slot' | 'at_time' | 'one_off'>

export interface BoardKid {
  id: string
  name: string
  emoji: string
  color: ColorToken
  items: BoardItem[]
  bonus: BonusItem[]
  totals: { approved: number; pending: number; planned: number; done: number }
}

export interface Board {
  today: string
  date: string
  is_today: boolean
  kids: BoardKid[]
}

export interface PendingCompletion {
  id: string
  date: string
  created_at: string
  kid: Pick<Kid, 'id' | 'name' | 'emoji' | 'color'>
  task: Pick<Task, 'id' | 'name' | 'emoji' | 'points' | 'team_points'>
  team_applies: boolean
  earned: number
}

export interface WeekDay {
  date: string
  items: { task_id: string; name: string; emoji: string; slot: Slot; at_time: string | null; one_off: boolean; planned_item_id: string | null }[]
}

// ---------- RPC ----------

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
  | 'not_planned'
  | 'already_done'
  | 'approved_by_parent'
  | 'network'

export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RpcError; retry_after?: number; count?: number }
