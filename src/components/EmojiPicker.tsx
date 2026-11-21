import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'

interface MartData { emojis: Record<string, { name: string; keywords?: string[]; skins: { unified: string }[] }> }
interface FrEmoji { hexcode: string; label: string; tags?: string[] }

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (hex: string) => hex.toLowerCase().replace(/-fe0f/g, '')

let frenchApplied = false
/**
 * emoji-mart only translates its UI, not emoji names. Merge French labels + tags from emojibase
 * so searching "chaussette" or "gâteau" works. Each word is added as its own keyword
 * (emoji-mart matches keyword prefixes), with an accent-free copy.
 */
function addFrenchNames(data: MartData, fr: FrEmoji[]) {
  if (frenchApplied) return
  frenchApplied = true
  const byHex = new Map(fr.map((e) => [norm(e.hexcode), e]))
  for (const emoji of Object.values(data.emojis)) {
    const f = byHex.get(norm(emoji.skins[0].unified))
    if (!f) continue
    const words = [f.label, ...(f.tags ?? [])]
      .flatMap((w) => w.toLowerCase().split(/[\s,:’'()-]+/))
      .filter((w) => w.length > 1)
    const all = new Set([...words, ...words.map(stripAccents), ...(emoji.keywords ?? [])])
    emoji.keywords = [...all]
    emoji.name = f.label.charAt(0).toUpperCase() + f.label.slice(1)
  }
}

/** Full emoji picker (emoji-mart) with French search; lazy-loaded so kids' views don't pay for it. */
function PickerPanel({ onSelect }: { onSelect: (emoji: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const cb = useRef(onSelect)
  cb.current = onSelect

  useEffect(() => {
    let cancelled = false
    Promise.all([
      import('emoji-mart'),
      import('@emoji-mart/data'),
      import('@emoji-mart/data/i18n/fr.json'),
      import('emojibase-data/fr/compact.json'),
    ]).then(([{ Picker }, data, fr, frNames]) => {
      if (cancelled || !ref.current) return
      addFrenchNames(data.default as MartData, frNames.default as FrEmoji[])
      const picker = new Picker({
        data: data.default,
        i18n: fr.default,
        locale: 'fr',
        theme: 'light',
        previewPosition: 'none',
        skinTonePosition: 'search',
        perLine: 8,
        emojiSize: 32,
        emojiButtonSize: 48,
        autoFocus: true,
        onEmojiSelect: (e: { native: string }) => cb.current(e.native),
      })
      ref.current.replaceChildren(picker as unknown as Node)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="emoji-picker">
      {loading && <p className="muted">Chargement des emoji…</p>}
      <div ref={ref} />
    </div>
  )
}

export function EmojiField({ value, onChange, label = 'Emoji' }: { value: string; onChange: (e: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <button type="button" className="emoji-field" onClick={() => setOpen(true)} aria-label="Choisir un emoji">
        <span className="emoji-field__value">{value || '➕'}</span>
        <span className="emoji-field__hint">{value ? 'Changer' : 'Choisir'}</span>
      </button>
      {open && (
        <Modal title="Choisis un emoji" onClose={() => setOpen(false)}>
          <PickerPanel
            onSelect={(e) => {
              onChange(e)
              setOpen(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}
