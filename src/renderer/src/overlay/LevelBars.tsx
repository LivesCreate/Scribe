import { useEffect, useRef } from 'react'

const BAR_COUNT = 18

/**
 * Live mic level bars, drawn on canvas via rAF so updates never touch the
 * React render path (spec: >= 30 fps, no jank).
 */
export function LevelBars({ level }: { level: number }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const levelRef = useRef(0)
  const historyRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => 0))

  levelRef.current = level

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const draw = (): void => {
      const history = historyRef.current
      history.push(Math.min(1, levelRef.current * 6))
      if (history.length > BAR_COUNT) history.shift()
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      const barW = width / BAR_COUNT
      const dot = Math.max(2, barW - 3) // quiet baseline: a small round dot
      for (let i = 0; i < history.length; i++) {
        const h = Math.max(dot, (history[i] ?? 0) * height)
        // Light, Wispr-style waveform: near-white, brighter as it grows.
        const amp = Math.min(1, h / height)
        ctx.fillStyle = `rgba(244, 244, 245, ${0.45 + amp * 0.5})`
        const x = i * barW + (barW - dot) / 2
        const y = (height - h) / 2
        ctx.beginPath()
        ctx.roundRect(x, y, dot, h, dot / 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} width={120} height={24} aria-hidden="true" />
}
