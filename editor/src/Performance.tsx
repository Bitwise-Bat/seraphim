import { useEffect, useState } from 'react'
import { useSettingsStore } from './settings_store'

type Metric = 'fps' | 'frame_time'

const metrics: { value: Metric; label: string; key: 'show_fps' | 'show_frame_time' }[] = [
  { value: 'fps', label: 'FPS', key: 'show_fps' },
  { value: 'frame_time', label: 'Frame time', key: 'show_frame_time' },
]

const update_interval_ms = 500

function format_metric(metric: Metric, frame_time: number): string {
  if (frame_time === 0) {
    return '—'
  }
  return metric === 'fps' ? `${Math.round(1000 / frame_time)} FPS` : `${frame_time.toFixed(2)} ms`
}

export function Performance() {
  const show_fps = useSettingsStore((store) => store.show_fps)
  const show_frame_time = useSettingsStore((store) => store.show_frame_time)
  const toggle_setting = useSettingsStore((store) => store.toggle_setting)
  const [frame_time, set_frame_time] = useState(0)
  const active = show_fps || show_frame_time

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

  const shown = metrics
    .filter((option) => (option.key === 'show_fps' ? show_fps : show_frame_time))
    .map((option) => format_metric(option.value, frame_time))

  return (
    <div className="performance">
      {shown.length > 0 && <output aria-label="Performance">{shown.join(' | ')}</output>}
      {metrics.map((option) => (
        <label key={option.value} className="performance-option">
          <input
            type="checkbox"
            checked={option.key === 'show_fps' ? show_fps : show_frame_time}
            onChange={() => toggle_setting(option.key)}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
