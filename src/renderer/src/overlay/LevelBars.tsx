import { useEffect, useRef } from 'react'

const BAR_COUNT = 14

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
      for (let i = 0; i < history.length; i++) {
        const h = Math.max(3, (history[i] ?? 0) * height)
        ctx.fillStyle = 'rgba(52, 211, 153, 0.9)'
        const x = i * barW + 1
        const y = (height - h) / 2
        ctx.beginPath()
        ctx.roundRect(x, y, barW - 2, h, 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} width={84} height={28} aria-hidden="true" />
}
