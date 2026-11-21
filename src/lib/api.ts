import { supabase } from './supabase'
import type { Category, CategoryKind, Frequency, Reward, RpcError, RpcResult, Task } from './types'

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

export async function fetchTasks(): Promise<Task[]> {
  // select('*') + normalisation keeps this working whether or not the
  // description/team_points migration has been applied yet.
  const { data, error } = await supabase.from('tasks').select('*').order('points').order('name')
  if (error) throw error
  return (data as Partial<Task>[]).map((t) => ({ ...t, description: t.description ?? null, team_points: t.team_points ?? null }) as Task)
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
  frequency: Frequency
  active: boolean
  description: string | null
  team_points: number | null
}
export async function upsertTask(pin: string, t: TaskInput): Promise<RpcResult<Task>> {
  const base = {
    p_pin: pin,
    p_id: t.id,
    p_name: t.name,
    p_emoji: t.emoji,
    p_points: t.points,
    p_category_id: t.category_id,
    p_frequency: t.frequency,
    p_active: t.active,
  }
  const { data, error } = await supabase.rpc('upsert_task', { ...base, p_description: t.description, p_team_points: t.team_points })
  if (!error) return data as RpcResult<Task>
  // PGRST202 = no function with these parameters: DB not migrated yet → save without the new fields.
  if (error.code === 'PGRST202') {
    console.warn('[rpc upsert_task] new parameters not available yet; saving without description/team points')
    return rpc<Task>('upsert_task', base)
  }
  console.error('[rpc upsert_task]', error)
  return { ok: false, error: 'network' }
}
export const deleteTask = (pin: string, id: string) => rpc<null>('delete_task', { p_pin: pin, p_id: id })

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
    case 'network':
    default:
      return 'Oups, problème de connexion. Réessaie !'
  }
}

/** Errors that mean the in-memory PIN is no longer valid → lock parent mode. */
export const isAuthError = (e: RpcError) => e === 'invalid_pin' || e === 'locked' || e === 'not_set'
