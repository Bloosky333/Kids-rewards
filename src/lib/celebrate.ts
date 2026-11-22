import confetti from 'canvas-confetti'

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const COLORS = ['#8b5cf6', '#ec4899', '#ffd34d', '#34d399', '#38bdf8']

/** Small burst from an element (task ticked). */
export function burstFrom(el: Element | null) {
  if (reduced() || !el) return
  const r = el.getBoundingClientRect()
  confetti({
    particleCount: 40,
    spread: 70,
    startVelocity: 28,
    scalar: 0.8,
    ticks: 120,
    colors: COLORS,
    origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
    disableForReducedMotion: true,
  })
}

/** Big celebration (all of today's planned tasks done). */
export function bigCelebration() {
  if (reduced()) return
  const end = Date.now() + 900
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS, disableForReducedMotion: true })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS, disableForReducedMotion: true })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

/** Floating "+N ★" label at an element. */
export function floatPoints(el: Element | null, text: string) {
  if (!el) return
  const r = el.getBoundingClientRect()
  const node = document.createElement('div')
  node.className = 'float-points'
  node.textContent = text
  node.style.left = `${r.left + r.width / 2}px`
  node.style.top = `${r.top}px`
  document.body.appendChild(node)
  window.setTimeout(() => node.remove(), 1200)
}
