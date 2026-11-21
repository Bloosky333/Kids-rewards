import type { Category, CategoryKind } from './types'

export interface Group<T> {
  category: Category
  items: T[]
}

/** Group items by category, in category sort order; items keep their incoming order. Empty groups dropped. */
export function groupByCategory<T extends { category_id: string }>(
  categories: Category[],
  kind: CategoryKind,
  items: T[],
): Group<T>[] {
  return categories
    .filter((c) => c.kind === kind)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'fr'))
    .map((category) => ({ category, items: items.filter((i) => i.category_id === category.id) }))
    .filter((g) => g.items.length > 0)
}
