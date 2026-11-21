import { useCategories, useRewards } from '../../lib/queries'
import { groupByCategory } from '../../lib/grouping'
import { CatalogPage } from './CatalogPage'
import { ItemCard } from './ItemCard'

export function ShopPage() {
  const cats = useCategories()
  const rewards = useRewards()
  const groups = groupByCategory(cats.data ?? [], 'reward', rewards.data ?? [])
  return (
    <CatalogPage
      title="La boutique"
      titleEmoji="🎁"
      queries={[cats, rewards]}
      groups={groups}
      emptyText="La boutique est vide pour l'instant 🛒"
      getKey={(r) => r.id}
      renderItem={(r, c, i) => <ItemCard emoji={r.emoji} name={r.name} value={r.cost} color={c.color} index={i} />}
    />
  )
}
