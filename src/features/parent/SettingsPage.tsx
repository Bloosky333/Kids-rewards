import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { PinPad } from '../../components/PinPad'
import { RecoveryHelp } from '../../components/RecoveryHelp'
import { useToast } from '../../components/Toast'
import { changePin } from '../../lib/api'
import { useParentSession } from './ParentSession'
import { useAdminAction } from './useAdmin'

export function SettingsPage() {
  const [changing, setChanging] = useState(false)
  return (
    <section>
      <div className="admin-head"><h1>⚙️ Réglages</h1></div>

      <div className="panel">
        <h2>🔑 Code parent</h2>
        <p className="muted">Change le code qui protège le mode parent.</p>
        <button className="btn" onClick={() => setChanging(true)}>Changer le code parent</button>
      </div>

      <div className="panel">
        <h2>🆘 Code oublié ?</h2>
        <RecoveryHelp />
      </div>

      {changing && <ChangePin onDone={() => setChanging(false)} />}
    </section>
  )
}

function ChangePin({ onDone }: { onDone: () => void }) {
  const { setPin } = useParentSession()
  const run = useAdminAction()
  const toast = useToast()
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
    const res = await run((pin) => changePin(pin, code))
    if (res.ok) {
      setPin(code)
      toast('Code modifié ✅', 'success')
      onDone()
      return
    }
    setFirst(null)
    return false
  }

  return (
    <Modal title="Changer le code parent" onClose={onDone}>
      <PinPad
        key={first ? 'confirm' : 'first'}
        title={first ? 'Confirme le nouveau code' : 'Nouveau code'}
        subtitle={first ? 'Tape le même code une 2e fois' : '4 chiffres'}
        onComplete={submit}
        error={error}
      />
    </Modal>
  )
}
