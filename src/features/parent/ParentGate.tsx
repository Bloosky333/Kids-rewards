import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PinPad } from '../../components/PinPad'
import { Modal } from '../../components/Modal'
import { RecoveryHelp } from '../../components/RecoveryHelp'
import { errorMessage, pinStatus, setupPin, verifyPin } from '../../lib/api'
import { qk } from '../../lib/queries'
import { useParentSession } from './ParentSession'
import { ParentLayout } from './ParentLayout'

/** Shows setup or unlock until the parent session holds a valid PIN. */
export function ParentGate() {
  const { pin } = useParentSession()
  const navigate = useNavigate()
  const status = useQuery({ queryKey: qk.pinStatus, queryFn: pinStatus, staleTime: 0, enabled: !pin })

  if (pin) return <ParentLayout />

  return (
    <div className="gate">
      <button className="icon-btn gate__close" onClick={() => navigate('/')} aria-label="Retour">✕</button>
      {status.isPending ? (
        <p className="muted">Chargement…</p>
      ) : status.isError ? (
        <div className="empty">
          <p className="empty__emoji">📡</p>
          <p>Connexion nécessaire pour le mode parent.</p>
          <button className="btn" onClick={() => status.refetch()}>Réessayer</button>
        </div>
      ) : status.data.is_set ? (
        <Unlock />
      ) : (
        <Setup />
      )}
    </div>
  )
}

function Unlock() {
  const { unlock } = useParentSession()
  const [error, setError] = useState<string | null>(null)
  const [lockedFor, setLockedFor] = useState(0)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    if (lockedFor <= 0) return
    const t = window.setTimeout(() => setLockedFor((s) => s - 1), 1000)
    if (lockedFor === 1) setError(null)
    return () => window.clearTimeout(t)
  }, [lockedFor])

  const submit = async (code: string) => {
    const res = await verifyPin(code)
    if (res.ok) {
      unlock(code)
      return
    }
    if (res.error === 'locked') {
      setLockedFor(res.retry_after ?? 60)
      setError(null)
      return false
    }
    setError(errorMessage(res))
    return false
  }

  return (
    <>
      <PinPad
        title="🔒 Mode parent"
        subtitle="Tape le code parent"
        onComplete={submit}
        disabled={lockedFor > 0}
        error={lockedFor > 0 ? `Trop d'essais, attends ${lockedFor} s ⏳` : error}
        footer={<button className="link-btn" onClick={() => setHelp(true)}>Code oublié ?</button>}
      />
      {help && (
        <Modal title="Code oublié ?" onClose={() => setHelp(false)}>
          <RecoveryHelp />
        </Modal>
      )}
    </>
  )
}

function Setup() {
  const { unlock } = useParentSession()
  const qc = useQueryClient()
  const [first, setFirst] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (code: string) => {
    if (!first) {
      setFirst(code)
      setError(null)
      return
    }
    if (code !== first) {
      setFirst(null)
      setError('Les codes ne correspondent pas, recommence')
      return false
    }
    const res = await setupPin(code)
    if (res.ok) {
      unlock(code)
      return
    }
    setFirst(null)
    setError(errorMessage(res))
    if (res.error === 'already_set') await qc.invalidateQueries({ queryKey: qk.pinStatus })
    return false
  }

  return (
    <PinPad
      key={first ? 'confirm' : 'first'}
      title={first ? 'Confirme ton code' : 'Choisis ton code parent'}
      subtitle={first ? 'Tape le même code une 2e fois' : '4 chiffres, à garder secret 🤫'}
      onComplete={submit}
      error={error}
    />
  )
}
