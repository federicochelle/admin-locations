import { RouterProvider } from 'react-router-dom'
import { router } from './app/router/routes'
import { AuthProvider } from './features/auth/AuthContext'

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App
