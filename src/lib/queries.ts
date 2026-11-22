import { useQuery } from '@tanstack/react-query'
import { fetchBoard, fetchCategories, fetchKids, fetchPendingCount, fetchRewards } from './api'

export const qk = {
  categories: ['public', 'categories'] as const,
  rewards: ['public', 'rewards'] as const,
  kids: ['public', 'kids'] as const,
  board: (date: string | 'today') => ['public', 'board', date] as const,
  pendingCount: ['public', 'pending-count'] as const,
  adminTasks: ['admin', 'tasks'] as const,
  adminRewards: ['admin', 'rewards'] as const,
  adminKids: ['admin', 'kids'] as const,
  adminPending: ['admin', 'pending'] as const,
  week: (kidId: string, from: string) => ['admin', 'week', kidId, from] as const,
  pinStatus: ['pin-status'] as const,
}

export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: fetchCategories })
export const useRewards = () => useQuery({ queryKey: qk.rewards, queryFn: fetchRewards })
export const useKids = () => useQuery({ queryKey: qk.kids, queryFn: fetchKids })

/** Board for a date ("today" lets the server decide). Refreshes every minute so ticks from other devices show up. */
export const useBoard = (date: string | 'today') =>
  useQuery({
    queryKey: qk.board(date),
    queryFn: () => fetchBoard(date === 'today' ? undefined : date),
    staleTime: 0, // always refetch on open/focus; the persisted copy only covers offline
    refetchInterval: 60_000,
  })

export const usePendingCount = () =>
  useQuery({ queryKey: qk.pendingCount, queryFn: fetchPendingCount, staleTime: 0, refetchInterval: 30_000 })
