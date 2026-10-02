import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AdminScreen } from './screens/AdminScreen'
import { JournalScreen } from './screens/JournalScreen'
import { LibraryScreen } from './screens/LibraryScreen'
import { SectorScreen } from './screens/SectorScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StockListScreen } from './screens/StockListScreen'
import { TrendsScreen } from './screens/TrendsScreen'
import { WorkspaceScreen } from './screens/WorkspaceScreen'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <WorkspaceScreen /> },
      { path: '/workspace', element: <WorkspaceScreen /> },
      { path: '/sector', element: <SectorScreen /> },
      { path: '/trends', element: <TrendsScreen /> },
      { path: '/journal', element: <JournalScreen /> },
      { path: '/list', element: <StockListScreen /> },
      { path: '/library', element: <LibraryScreen /> },
      { path: '/admin', element: <AdminScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
