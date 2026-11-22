import { Navigate, Route, Routes } from 'react-router-dom'
import { BoardPage } from './features/board/BoardPage'
import { KidSpace } from './features/kidspace/KidSpace'
import { ParentGate } from './features/parent/ParentGate'
import { ParentSessionProvider } from './features/parent/ParentSession'

export default function App() {
  return (
    <ParentSessionProvider>
      <div className="bg" aria-hidden="true">
        <span className="bg__blob bg__blob--1" />
        <span className="bg__blob bg__blob--2" />
        <span className="bg__blob bg__blob--3" />
      </div>
      <Routes>
        <Route index element={<BoardPage />} />
        <Route path="enfant/:kidId/*" element={<KidSpace />} />
        <Route path="parent/*" element={<ParentGate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ParentSessionProvider>
  )
}
