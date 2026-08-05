import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { SettingsScreen } from './screens/SettingsScreen'
import { StubScreen } from './screens/StubScreen'
import { WorkspaceScreen } from './screens/WorkspaceScreen'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <WorkspaceScreen /> },
      { path: '/workspace', element: <WorkspaceScreen /> },
      { path: '/sector', element: <StubScreen title='Sector analysis' /> },
      { path: '/trends', element: <StubScreen title='Weekly sector trends' /> },
      { path: '/journal', element: <StubScreen title='Trading journal' /> },
      { path: '/list', element: <StubScreen title='Stock list' /> },
      { path: '/library', element: <StubScreen title='Library · reader' /> },
      { path: '/admin', element: <StubScreen title='Admin' /> },
      { path: '/settings', element: <SettingsScreen /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
