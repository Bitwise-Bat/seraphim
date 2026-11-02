import { useEffect, useRef, useState } from 'react'
import { useConsoleStore, type LogItem } from './console/console_store'

export function Console() {
  const logs = useConsoleStore((store) => store.logs)
  const filter_level = useConsoleStore((store) => store.filter_level)
  const search_query = useConsoleStore((store) => store.search_query)
  const set_filter_level = useConsoleStore((store) => store.set_filter_level)
  const set_search_query = useConsoleStore((store) => store.set_search_query)
  const clear = useConsoleStore((store) => store.clear)
  const error_count = useConsoleStore((store) => store.error_count)
  const warn_count = useConsoleStore((store) => store.warn_count)

  const list_ref = useRef<HTMLDivElement | null>(null)
  const [auto_scroll, set_auto_scroll] = useState(true)

  // Auto-scroll when new logs arrive if user hasn't scrolled up
  useEffect(() => {
    if (auto_scroll && list_ref.current) {
      list_ref.current.scrollTop = list_ref.current.scrollHeight
    }
  }, [logs, auto_scroll])

  function handle_scroll() {
    if (!list_ref.current) return
    const { scrollTop, scrollHeight, clientHeight } = list_ref.current
    const is_near_bottom = scrollHeight - scrollTop - clientHeight < 30
    set_auto_scroll(is_near_bottom)
  }

  const filtered_logs = logs.filter((item: LogItem) => {
    if (filter_level !== 'all') {
      if (filter_level === 'log' && item.level !== 'log' && item.level !== 'info') return false
      if (filter_level !== 'log' && item.level !== filter_level) return false
    }
    if (search_query) {
      return item.message.toLowerCase().includes(search_query.toLowerCase())
    }
    return true
  })

  const filter_btn_class = (level: string, active_color?: string) => {
    const is_active = filter_level === level
    if (is_active) {
      return `px-2 py-0.5 border-0 text-xs rounded-[0.2rem] cursor-pointer bg-control font-semibold ${
        active_color ?? 'text-text'
      }`
    }
    return 'px-2 py-0.5 border-0 bg-transparent text-text-muted text-xs rounded-[0.2rem] cursor-pointer hover:text-text hover:bg-control-hover transition-colors'
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-panel" aria-label="Console">
      <div className="flex items-center justify-between px-2 py-1 bg-control border-b border-border gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-0.5 border border-border rounded bg-control text-[0.85rem] shrink-0 hover:bg-control-hover transition-colors cursor-pointer text-inherit"
            title="Clear console"
            onClick={clear}
          >
            Clear
          </button>
          <div className="flex gap-[2px] bg-background border border-border rounded p-[1px]">
            <button
              type="button"
              className={filter_btn_class('all')}
              onClick={() => set_filter_level('all')}
            >
              All ({logs.length})
            </button>
            <button
              type="button"
              className={filter_btn_class('error', 'text-red-400')}
              onClick={() => set_filter_level('error')}
            >
              Errors ({error_count})
            </button>
            <button
              type="button"
              className={filter_btn_class('warn', 'text-amber-400')}
              onClick={() => set_filter_level('warn')}
            >
              Warnings ({warn_count})
            </button>
            <button
              type="button"
              className={filter_btn_class('log')}
              onClick={() => set_filter_level('log')}
            >
              Info
            </button>
          </div>
        </div>
        <div>
          <input
            type="search"
            placeholder="Filter logs..."
            value={search_query}
            onChange={(e) => set_search_query(e.target.value)}
            className="bg-background border border-border rounded text-text px-2 py-0.5 text-xs outline-none w-40 focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div ref={list_ref} className="flex-1 overflow-y-auto font-mono text-[0.78rem] leading-[1.4] py-1" onScroll={handle_scroll}>
        {filtered_logs.length === 0 ? (
          <p className="p-4 m-0 text-text-muted text-sm">No console output.</p>
        ) : (
          filtered_logs.map((item) => {
            const line_theme =
              item.level === 'error'
                ? 'bg-red-500/10 text-red-200 border-l-[3px] border-l-red-500'
                : item.level === 'warn'
                ? 'bg-amber-500/[0.08] text-amber-200 border-l-[3px] border-l-amber-500'
                : 'text-text border-l-[3px] border-l-transparent'

            const badge_theme =
              item.level === 'error'
                ? 'bg-red-600 text-white'
                : item.level === 'warn'
                ? 'bg-amber-600 text-white'
                : 'bg-border text-text-muted'

            return (
              <div
                key={item.id}
                className={`flex items-start gap-2 py-[0.2rem] px-3 border-b border-white/[0.03] hover:bg-white/[0.02] ${line_theme}`}
              >
                <span className="text-text-muted text-[0.72rem] shrink-0 select-none">{item.time}</span>
                <span className={`text-[0.65rem] font-bold px-[0.3rem] py-[0.05rem] rounded-[0.2rem] shrink-0 select-none ${badge_theme}`}>
                  {item.level.toUpperCase()}
                </span>
                <span className="whitespace-pre-wrap break-words flex-1">{item.message}</span>
                {item.count > 1 && (
                  <span className="bg-control-hover border border-border rounded-full px-[0.35rem] text-[0.65rem] font-semibold text-text-muted shrink-0">
                    {item.count}
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
