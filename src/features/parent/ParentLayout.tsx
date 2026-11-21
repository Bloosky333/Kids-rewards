import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useParentSession } from './ParentSession'
import { ItemsAdmin } from './ItemsAdmin'
import { CategoriesAdmin } from './CategoriesAdmin'
import { SettingsPage } from './SettingsPage'

export function ParentLayout() {
  const { lock } = useParentSession()
  return (
    <div className="parent">
      <header className="parent__banner">
        <span className="parent__title">🔓 Mode parent</span>
        <button className="btn btn--small btn--ghost" onClick={lock}>🔒 Verrouiller</button>
      </header>
      <nav className="parent__tabs" aria-label="Sections">
        <NavLink to="/parent" end>🎯 Missions</NavLink>
        <NavLink to="/parent/boutique">🎁 Boutique</NavLink>
        <NavLink to="/parent/categories">🗂️ Catégories</NavLink>
        <NavLink to="/parent/reglages">⚙️ Réglages</NavLink>
      </nav>
      <main className="parent__main">
        <Routes>
          <Route index element={<ItemsAdmin kind="task" />} />
          <Route path="boutique" element={<ItemsAdmin kind="reward" />} />
          <Route path="categories" element={<CategoriesAdmin />} />
          <Route path="reglages" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/parent" replace />} />
        </Routes>
      </main>
    </div>
  )
}
