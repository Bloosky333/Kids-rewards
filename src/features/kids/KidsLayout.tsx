import { Link, NavLink, Outlet } from 'react-router-dom'

export function KidsLayout() {
  return (
    <div className="kids">
      <Link to="/parent" className="lock-btn" aria-label="Mode parent">🔒</Link>
      <main className="kids__main">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navigation">
        <NavLink to="/" end className="tabbar__tab tabbar__tab--missions">
          <span className="tabbar__emoji" aria-hidden="true">🎯</span>
          <span>Mes missions</span>
        </NavLink>
        <NavLink to="/boutique" className="tabbar__tab tabbar__tab--shop">
          <span className="tabbar__emoji" aria-hidden="true">🎁</span>
          <span>La boutique</span>
        </NavLink>
      </nav>
    </div>
  )
}
