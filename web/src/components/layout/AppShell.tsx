import { Outlet } from 'react-router-dom'
import { NavRail } from './NavRail'

export function AppShell() {
  return (
    <div className='app-shell'>
      <NavRail />
      <main className='main-area'>
        <Outlet />
      </main>
    </div>
  )
}
