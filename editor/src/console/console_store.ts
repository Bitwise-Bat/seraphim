import { create } from 'zustand'

export type LogLevel = 'log' | 'info' | 'warn' | 'error'

export type LogItem = {
  id: string
  level: LogLevel
  message: string
  time: string
  count: number
}

type ConsoleState = {
  logs: LogItem[]
  filter_level: LogLevel | 'all'
  search_query: string
  error_count: number
  warn_count: number
  add_log: (level: LogLevel, ...args: unknown[]) => void
  clear: () => void
  set_filter_level: (level: LogLevel | 'all') => void
  set_search_query: (query: string) => void
}

function safe_format(arg: unknown): string {
  if (arg === null) return 'null'
  if (arg === undefined) return 'undefined'
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg)
    } catch {
      return Object.prototype.toString.call(arg)
    }
  }
  return String(arg)
}

function format_message(args: unknown[]): string {
  return args.map(safe_format).join(' ')
}

function current_time(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export const useConsoleStore = create<ConsoleState>()((set, get) => ({
  logs: [],
  filter_level: 'all',
  search_query: '',
  error_count: 0,
  warn_count: 0,

  add_log(level, ...args) {
    const message = format_message(args)
    if (!message.trim()) return

    const { logs, error_count, warn_count } = get()
    const last = logs[logs.length - 1]

    if (last && last.level === level && last.message === message) {
      const updated_logs = [...logs]
      updated_logs[updated_logs.length - 1] = {
        ...last,
        count: last.count + 1,
      }
      set({ logs: updated_logs })
      return
    }

    const new_item: LogItem = {
      id: crypto.randomUUID(),
      level,
      message,
      time: current_time(),
      count: 1,
    }

    const next_logs = logs.length >= 1000 ? [...logs.slice(logs.length - 999), new_item] : [...logs, new_item]

    set({
      logs: next_logs,
      error_count: level === 'error' ? error_count + 1 : error_count,
      warn_count: level === 'warn' ? warn_count + 1 : warn_count,
    })
  },

  clear() {
    set({ logs: [], error_count: 0, warn_count: 0 })
  },

  set_filter_level(level) {
    set({ filter_level: level })
  },

  set_search_query(query) {
    set({ search_query: query })
  },
}))

// Intercept window and console logs once globally
let intercepted = false

export function init_console_interception(): void {
  if (intercepted) return
  intercepted = true

  const original_log = console.log
  const original_info = console.info
  const original_warn = console.warn
  const original_error = console.error

  console.log = (...args: unknown[]) => {
    useConsoleStore.getState().add_log('log', ...args)
    original_log.apply(console, args)
  }

  console.info = (...args: unknown[]) => {
    useConsoleStore.getState().add_log('info', ...args)
    original_info.apply(console, args)
  }

  console.warn = (...args: unknown[]) => {
    useConsoleStore.getState().add_log('warn', ...args)
    original_warn.apply(console, args)
  }

  console.error = (...args: unknown[]) => {
    useConsoleStore.getState().add_log('error', ...args)
    original_error.apply(console, args)
  }

  window.addEventListener('error', (event) => {
    const error_msg = event.error ? safe_format(event.error) : event.message
    useConsoleStore.getState().add_log('error', error_msg)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason_msg = event.reason ? safe_format(event.reason) : 'Unhandled promise rejection'
    useConsoleStore.getState().add_log('error', reason_msg)
  })
}
