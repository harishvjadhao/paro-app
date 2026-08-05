import {
  Activity,
  BarChart3,
  BookOpen,
  Bookmark,
  FlaskConical,
  LayoutDashboard,
  Layers,
  NotebookPen,
  Settings,
  SlidersHorizontal,
  Table2,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

type NavItem = {
  label: string
  to: string
  Icon: typeof LayoutDashboard
}

const navItems: NavItem[] = [
  { label: 'Market workspace', to: '/workspace?filter=all', Icon: LayoutDashboard },
  { label: 'Signals · above 44 MA', to: '/workspace?filter=ma', Icon: Activity },
  { label: 'Watchlist', to: '/workspace?filter=watch', Icon: Bookmark },
  { label: 'Research · favorites', to: '/workspace?filter=fav', Icon: FlaskConical },
  { label: 'Sector analysis', to: '/sector', Icon: Layers },
  { label: 'Weekly sector trends', to: '/trends', Icon: BarChart3 },
  { label: 'Trading journal', to: '/journal', Icon: NotebookPen },
  { label: 'Stock list', to: '/list', Icon: Table2 },
  { label: 'Library · reader', to: '/library', Icon: BookOpen },
  { label: 'Admin', to: '/admin', Icon: SlidersHorizontal },
]

export function NavRail() {
  return (
    <aside className='rail-wrap'>
      <div className='rail'>
        <div className='brand-pill'>P</div>
        <nav className='rail-links' aria-label='Primary navigation'>
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) => `rail-btn ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
            </NavLink>
          ))}
        </nav>
        <NavLink to='/settings' title='Settings' className={({ isActive }) => `rail-btn ${isActive ? 'active' : ''}`}>
          <Settings size={16} />
        </NavLink>
      </div>
    </aside>
  )
}
