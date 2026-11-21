import { Navigate, Route, Routes } from 'react-router-dom'
import { KidsLayout } from './features/kids/KidsLayout'
import { MissionsPage } from './features/kids/MissionsPage'
import { ShopPage } from './features/kids/ShopPage'
import { ParentGate } from './features/parent/ParentGate'
import { ParentSessionProvider } from './features/parent/ParentSession'

export default function App() {
  return (
    <ParentSessionProvider>
      <Routes>
        <Route element={<KidsLayout />}>
          <Route index element={<MissionsPage />} />
          <Route path="boutique" element={<ShopPage />} />
        </Route>
        <Route path="parent/*" element={<ParentGate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ParentSessionProvider>
  )
}
