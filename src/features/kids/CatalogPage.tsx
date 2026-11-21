import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Category } from '../../lib/types'
import type { Group } from '../../lib/grouping'

interface Props<T> {
  title: string
  titleEmoji: string
  queries: UseQueryResult<unknown>[]
  groups: Group<T>[]
  emptyText: string
  renderItem: (item: T, category: Category, index: number) => ReactNode
  getKey: (item: T) => string
}

export function CatalogPage<T>({ title, titleEmoji, queries, groups, emptyText, renderItem, getKey }: Props<T>) {
  const loading = queries.some((q) => q.isPending)
  const failed = queries.find((q) => q.isError && q.data === undefined)
  const offline = queries.some((q) => q.isError && q.data !== undefined)

  return (
    <section>
      <h1 className="page-title">
        <span aria-hidden="true">{titleEmoji}</span> {title}
      </h1>
      {offline && <p className="banner banner--warn">📡 Pas de connexion : voici la dernière liste connue.</p>}
      {loading ? (
        <div className="grid">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="card card--skeleton" />)}
        </div>
      ) : failed ? (
        <div className="empty">
          <p className="empty__emoji">😕</p>
          <p>Impossible de charger la liste.</p>
          <button className="btn" onClick={() => queries.forEach((q) => q.refetch())}>Réessayer</button>
        </div>
      ) : groups.length === 0 ? (
        <div className="empty">
          <p className="empty__emoji">🙂</p>
          <p>{emptyText}</p>
        </div>
      ) : (
        groups.map((g) => {
          let i = 0
          return (
            <section key={g.category.id} className={`group c-${g.category.color}`}>
              <h2 className="group__title">
                <span className="group__emoji" aria-hidden="true">{g.category.emoji}</span>
                {g.category.name}
              </h2>
              <div className="grid">
                {g.items.map((item) => <div key={getKey(item)} className="grid__cell">{renderItem(item, g.category, i++)}</div>)}
              </div>
            </section>
          )
        })
      )}
    </section>
  )
}
