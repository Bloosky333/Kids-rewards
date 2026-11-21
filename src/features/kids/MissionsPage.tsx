import { useCategories, useTasks } from '../../lib/queries'
import { groupByCategory } from '../../lib/grouping'
import { CatalogPage } from './CatalogPage'
import { ItemCard } from './ItemCard'

export function MissionsPage() {
  const cats = useCategories()
  const tasks = useTasks()
  const groups = groupByCategory(cats.data ?? [], 'task', tasks.data ?? [])
  return (
    <CatalogPage
      title="Mes missions"
      titleEmoji="🎯"
      queries={[cats, tasks]}
      groups={groups}
      emptyText="Pas encore de missions ! Demande à papa ou maman 🙂"
      getKey={(t) => t.id}
      renderItem={(t, c, i) => (
        <ItemCard emoji={t.emoji} name={t.name} value={t.points} color={c.color} frequency={t.frequency} index={i} />
      )}
    />
  )
}
