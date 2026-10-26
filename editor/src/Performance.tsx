import { useEffect, useState } from 'react'

type Metric = 'fps' | 'frame_time'

const metrics: { value: Metric; label: string }[] = [
  { value: 'fps', label: 'FPS' },
  { value: 'frame_time', label: 'Frame time' },
]

const update_interval_ms = 500

function format_metric(metric: Metric, frame_time: number): string {
  if (frame_time === 0) {
    return '—'
  }
  return metric === 'fps' ? `${Math.round(1000 / frame_time)} FPS` : `${frame_time.toFixed(2)} ms`
}

export function Performance() {
  const [enabled, set_enabled] = useState<Record<Metric, boolean>>({ fps: true, frame_time: false })
  const [frame_time, set_frame_time] = useState(0)
  const active = enabled.fps || enabled.frame_time

  useEffect(() => {
    if (!active) {
      return
    }
    let frames = 0
    let last_time = performance.now()
    let frame_id = 0

    function tick(now: number) {
      frames++
      const elapsed = now - last_time
      if (elapsed >= update_interval_ms) {
        set_frame_time(elapsed / frames)
        frames = 0
        last_time = now
      }
      frame_id = requestAnimationFrame(tick)
    }

    frame_id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame_id)
  }, [active])

  const shown = metrics.filter((option) => enabled[option.value]).map((option) => format_metric(option.value, frame_time))

  return (
    <div className="performance">
      {shown.length > 0 && <output aria-label="Performance">{shown.join(' | ')}</output>}
      {metrics.map((option) => (
        <label key={option.value} className="performance-option">
          <input
            type="checkbox"
            checked={enabled[option.value]}
            onChange={(event) => {
              const next = { ...enabled, [option.value]: event.target.checked }
              set_enabled(next)
              if (!next.fps && !next.frame_time) {
                set_frame_time(0)
              }
            }}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}