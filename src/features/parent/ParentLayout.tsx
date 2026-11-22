import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { usePendingCount } from '../../lib/queries'
import { useParentSession } from './ParentSession'
import { ApprovalsPage } from './ApprovalsPage'
import { TasksAdmin } from './TasksAdmin'
import { KidsAdmin } from './KidsAdmin'
import { RewardsAdmin } from './RewardsAdmin'
import { CategoriesAdmin } from './CategoriesAdmin'
import { SettingsPage } from './SettingsPage'

export function ParentLayout() {
  const { lock } = useParentSession()
  const pending = usePendingCount()
  return (
    <div className="parent">
      <header className="parent__banner">
        <span className="parent__title">🔓 Mode parent</span>
        <button className="btn btn--small btn--ghost" onClick={lock} title="Quitter le mode parent et revenir au tableau">
          🔒 Verrouiller
        </button>
      </header>
      <nav className="parent__tabs" aria-label="Sections">
        <NavLink to="/parent" end>
          ✅ À valider{!!pending.data && <span className="tab-badge">{pending.data}</span>}
        </NavLink>
        <NavLink to="/parent/missions">🎯 Missions</NavLink>
        <NavLink to="/parent/enfants">👧 Enfants</NavLink>
        <NavLink to="/parent/boutique">🎁 Boutique</NavLink>
        <NavLink to="/parent/categories">🗂️ Catégories</NavLink>
        <NavLink to="/parent/reglages">⚙️ Réglages</NavLink>
      </nav>
      <main className="parent__main">
        <Routes>
          <Route index element={<ApprovalsPage />} />
          <Route path="missions" element={<TasksAdmin />} />
          <Route path="enfants" element={<KidsAdmin />} />
          <Route path="boutique" element={<RewardsAdmin />} />
          <Route path="categories" element={<CategoriesAdmin />} />
          <Route path="reglages" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/parent" replace />} />
        </Routes>
      </main>
    </div>
  )
}
