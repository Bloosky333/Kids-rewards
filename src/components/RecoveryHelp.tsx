import { useToast } from './Toast'

const SQL = 'select kids_rewards.reset_pin();'

export function RecoveryHelp() {
  const toast = useToast()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SQL)
      toast('Commande copiée 📋', 'success')
    } catch {
      toast('Copie impossible, sélectionne le texte à la main', 'error')
    }
  }
  return (
    <div className="recovery">
      <p>Tu as oublié le code parent ? Pas de panique :</p>
      <ol>
        <li>Ouvre <strong>supabase.com</strong> → projet <strong>Personal</strong> → <strong>SQL Editor</strong>.</li>
        <li>Exécute cette commande :</li>
      </ol>
      <div className="recovery__code">
        <code>{SQL}</code>
        <button type="button" className="btn btn--small" onClick={copy}>Copier la commande</button>
      </div>
      <ol start={3}>
        <li>Reviens ici et touche 🔒 : l'app te demandera de choisir un nouveau code.</li>
      </ol>
    </div>
  )
}
