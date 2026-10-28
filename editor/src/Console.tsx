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

  return (
    <div className="console-panel" aria-label="Console">
      <div className="console-toolbar">
        <div className="console-actions">
          <button type="button" className="toolbar-button" title="Clear console" onClick={clear}>
            Clear
          </button>
          <div className="console-filter-buttons">
            <button
              type="button"
              className={`console-filter-btn${filter_level === 'all' ? ' active' : ''}`}
              onClick={() => set_filter_level('all')}
            >
              All ({logs.length})
            </button>
            <button
              type="button"
              className={`console-filter-btn${filter_level === 'error' ? ' active error-active' : ''}`}
              onClick={() => set_filter_level('error')}
            >
              Errors ({error_count})
            </button>
            <button
              type="button"
              className={`console-filter-btn${filter_level === 'warn' ? ' active warn-active' : ''}`}
              onClick={() => set_filter_level('warn')}
            >
              Warnings ({warn_count})
            </button>
            <button
              type="button"
              className={`console-filter-btn${filter_level === 'log' ? ' active' : ''}`}
              onClick={() => set_filter_level('log')}
            >
              Info
            </button>
          </div>
        </div>
        <div className="console-search">
          <input
            type="search"
            placeholder="Filter logs..."
            value={search_query}
            onChange={(e) => set_search_query(e.target.value)}
            className="console-search-input"
          />
        </div>
      </div>

      <div ref={list_ref} className="console-logs" onScroll={handle_scroll}>
        {filtered_logs.length === 0 ? (
          <p className="panel-hint console-empty">No console output.</p>
        ) : (
          filtered_logs.map((item) => (
            <div key={item.id} className={`console-line console-line-${item.level}`}>
              <span className="console-time">{item.time}</span>
              <span className={`console-badge badge-${item.level}`}>{item.level.toUpperCase()}</span>
              <span className="console-msg">{item.message}</span>
              {item.count > 1 && <span className="console-count">{item.count}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
