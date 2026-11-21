import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

export function KidsLayout() {
  const { pathname } = useLocation()
  return (
    <div className="kids">
      <div className="bg" aria-hidden="true">
        <span className="bg__blob bg__blob--1" />
        <span className="bg__blob bg__blob--2" />
        <span className="bg__blob bg__blob--3" />
      </div>
      <Link to="/parent" className="lock-btn" aria-label="Mode parent">🔒</Link>
      <main className="kids__main">
        <div key={pathname} className="page">
          <Outlet />
        </div>
      </main>
      <nav className="tabbar" aria-label="Navigation">
        <div className="dock">
          <NavLink to="/" end className="dock__tab">
            <span className="dock__emoji" aria-hidden="true">🎯</span>
            <span>Mes missions</span>
          </NavLink>
          <NavLink to="/boutique" className="dock__tab">
            <span className="dock__emoji" aria-hidden="true">🎁</span>
            <span>La boutique</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
