import { supabase } from './supabase'
import type { Board, Category, CategoryKind, Kid, PendingCompletion, Reward, RpcError, RpcResult, Slot, Task, TaskKind, WeekDay, Weekday } from './types'

// ---------- public reads (RLS hides inactive items) ----------

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, kind, name, emoji, color, sort_order')
    .order('sort_order')
    .order('name')
  if (error) throw error
  return data as Category[]
}

export async function fetchRewards(): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select('id, name, emoji, cost, category_id, active')
    .order('cost')
    .order('name')
  if (error) throw error
  return data as Reward[]
}

// ---------- RPC wrapper ----------

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<RpcResult<T>> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    console.error(`[rpc ${fn}]`, error)
    return { ok: false, error: 'network' }
  }
  return data as RpcResult<T>
}

export const pinStatus = async (): Promise<{ is_set: boolean }> => {
  const { data, error } = await supabase.rpc('pin_status')
  if (error) throw error
  return data as { is_set: boolean }
}
export const setupPin = (pin: string) => rpc<null>('setup_pin', { p_new: pin })
export const verifyPin = (pin: string) => rpc<null>('verify_pin', { p_pin: pin })
export const changePin = (pin: string, next: string) => rpc<null>('change_pin', { p_pin: pin, p_new: next })

export const adminListTasks = (pin: string) => rpc<Task[]>('admin_list_tasks', { p_pin: pin })
export const adminListRewards = (pin: string) => rpc<Reward[]>('admin_list_rewards', { p_pin: pin })

export interface TaskInput {
  id: string | null
  name: string
  emoji: string
  points: number
  category_id: string
  active: boolean
  description: string | null
  team_points: number | null
  kind: TaskKind
  assign_all: boolean
  kid_ids: string[]
  days: Weekday[] | null
  slot: Slot
  at_time: string | null
  needs_approval: boolean
}
export const saveTask = (pin: string, t: TaskInput) =>
  rpc<Task>('save_task', {
    p_pin: pin,
    p_id: t.id,
    p_name: t.name,
    p_emoji: t.emoji,
    p_points: t.points,
    p_category_id: t.category_id,
    p_active: t.active,
    p_description: t.description,
    p_team_points: t.team_points,
    p_kind: t.kind,
    p_assign_all: t.assign_all,
    p_kid_ids: t.kid_ids,
    p_days: t.kind === 'planned' ? t.days : null,
    p_slot: t.slot,
    p_at_time: t.at_time,
    p_needs_approval: t.needs_approval,
  })
export const archiveTask = (pin: string, id: string) => rpc<null>('archive_task', { p_pin: pin, p_id: id })

export interface RewardInput {
  id: string | null
  name: string
  emoji: string
  cost: number
  category_id: string
  active: boolean
}
export const upsertReward = (pin: string, r: RewardInput) =>
  rpc<Reward>('upsert_reward', {
    p_pin: pin,
    p_id: r.id,
    p_name: r.name,
    p_emoji: r.emoji,
    p_cost: r.cost,
    p_category_id: r.category_id,
    p_active: r.active,
  })
export const deleteReward = (pin: string, id: string) => rpc<null>('delete_reward', { p_pin: pin, p_id: id })

export interface CategoryInput {
  id: string | null
  kind: CategoryKind
  name: string
  emoji: string
  color: string
}
export const upsertCategory = (pin: string, c: CategoryInput) =>
  rpc<Category>('upsert_category', {
    p_pin: pin,
    p_id: c.id,
    p_kind: c.kind,
    p_name: c.name,
    p_emoji: c.emoji,
    p_color: c.color,
  })
export const reorderCategories = (pin: string, kind: CategoryKind, ids: string[]) =>
  rpc<null>('reorder_categories', { p_pin: pin, p_kind: kind, p_ids: ids })
export const deleteCategory = (pin: string, id: string) => rpc<null>('delete_category', { p_pin: pin, p_id: id })

// ---------- kids & day board (public) ----------

export async function fetchKids(): Promise<Kid[]> {
  const { data, error } = await supabase.from('kids').select('id, name, emoji, color, sort_order, active').order('sort_order').order('name')
  if (error) throw error
  return data as Kid[]
}

export async function fetchBoard(date?: string): Promise<Board> {
  const { data, error } = await supabase.rpc('day_board', date ? { p_date: date } : {})
  if (error) throw error
  return data as Board
}

export async function fetchPendingCount(): Promise<number> {
  const { data, error } = await supabase.rpc('pending_count')
  if (error) throw error
  return data as number
}

export async function fetchWeekPlan(kidId: string, from: string): Promise<WeekDay[]> {
  const { data, error } = await supabase.rpc('week_plan', { p_kid: kidId, p_from: from })
  if (error) throw error
  return data as WeekDay[]
}

export type CompleteResult = { status: 'pending' | 'approved'; team_completed: boolean; earned: number }
export const completeTask = (kidId: string, taskId: string) => rpc<CompleteResult>('complete_task', { p_kid: kidId, p_task: taskId })
export const uncompleteTask = (kidId: string, taskId: string) => rpc<null>('uncomplete_task', { p_kid: kidId, p_task: taskId })

// ---------- kids, approvals & planning (parent) ----------

export const adminListKids = (pin: string) => rpc<Kid[]>('admin_list_kids', { p_pin: pin })
export interface KidInput { id: string | null; name: string; emoji: string; color: string; active: boolean }
export const upsertKid = (pin: string, k: KidInput) =>
  rpc<Kid>('upsert_kid', { p_pin: pin, p_id: k.id, p_name: k.name, p_emoji: k.emoji, p_color: k.color, p_active: k.active })
export const reorderKids = (pin: string, ids: string[]) => rpc<null>('reorder_kids', { p_pin: pin, p_ids: ids })

export const listPending = (pin: string) => rpc<PendingCompletion[]>('list_pending', { p_pin: pin })
export const setCompletionsStatus = (pin: string, ids: string[], status: 'approved' | 'cancelled') =>
  rpc<{ updated: number }>('set_completions_status', { p_pin: pin, p_ids: ids, p_status: status })
export const setCompletion = (pin: string, kidId: string, taskId: string, date: string, done: boolean) =>
  rpc<null>('set_completion', { p_pin: pin, p_kid: kidId, p_task: taskId, p_date: date, p_done: done })

export const addPlannedItems = (pin: string, taskId: string, kidIds: string[], date: string, slot: Slot, atTime: string | null) =>
  rpc<null>('add_planned_items', { p_pin: pin, p_task: taskId, p_kid_ids: kidIds, p_date: date, p_slot: slot, p_at_time: atTime })
export const removePlannedItem = (pin: string, id: string) => rpc<null>('remove_planned_item', { p_pin: pin, p_id: id })

// ---------- French error messages ----------

export function errorMessage(r: { error: RpcError; retry_after?: number; count?: number }): string {
  switch (r.error) {
    case 'invalid_pin':
      return 'Code incorrect'
    case 'locked':
      return `Trop d'essais, attends ${r.retry_after ?? 60} secondes ⏳`
    case 'not_set':
      return "Aucun code parent n'est défini"
    case 'already_set':
      return 'Un code parent existe déjà'
    case 'invalid_format':
      return 'Le code doit avoir 4 chiffres'
    case 'invalid_input':
      return 'Vérifie les champs du formulaire'
    case 'invalid_category':
      return 'Choisis une catégorie valide'
    case 'duplicate_name':
      return 'Ce nom de catégorie existe déjà'
    case 'category_not_empty':
      return `Cette catégorie contient ${r.count ?? 'des'} élément(s). Déplace-les d'abord.`
    case 'not_found':
      return "Cet élément n'existe plus"
    case 'not_planned':
      return "Cette mission n'est pas prévue pour toi aujourd'hui"
    case 'already_done':
      return 'Déjà fait aujourd’hui ✅'
    case 'approved_by_parent':
      return 'Déjà validé par un parent 🔒'
    case 'network':
    default:
      return 'Oups, problème de connexion. Réessaie !'
  }
}

/** Errors that mean the in-memory PIN is no longer valid → lock parent mode. */
export const isAuthError = (e: RpcError) => e === 'invalid_pin' || e === 'locked' || e === 'not_set'
