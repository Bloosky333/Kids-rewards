import { useQuery } from '@tanstack/react-query'
import { fetchCategories, fetchRewards, fetchTasks } from './api'

export const qk = {
  categories: ['public', 'categories'] as const,
  tasks: ['public', 'tasks'] as const,
  rewards: ['public', 'rewards'] as const,
  adminTasks: ['admin', 'tasks'] as const,
  adminRewards: ['admin', 'rewards'] as const,
  pinStatus: ['pin-status'] as const,
}

export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: fetchCategories })
export const useTasks = () => useQuery({ queryKey: qk.tasks, queryFn: fetchTasks })
export const useRewards = () => useQuery({ queryKey: qk.rewards, queryFn: fetchRewards })
