import { AssetBrowser } from './AssetBrowser'
import { Console } from './Console'
import { useConsoleStore } from './console/console_store'
import { useSettingsStore, type DockTab } from './settings_store'

export type { DockTab }

export function DockSlot() {
  const active_tab = useSettingsStore((store) => store.dock_tab)
  const set_setting = useSettingsStore((store) => store.set_setting)
  const error_count = useConsoleStore((store) => store.error_count)

  const set_active_tab = (tab: DockTab) => set_setting('dock_tab', tab)

  const tab_class = (tab: DockTab) =>
    `inline-flex items-center gap-[0.35rem] px-3 bg-transparent border-0 border-b-2 font-medium cursor-pointer h-full text-[0.8rem] transition-colors focus-visible:outline-none ${
      active_tab === tab
        ? 'text-text bg-panel border-b-accent'
        : 'border-b-transparent text-text-muted hover:text-text hover:bg-control'
    }`

  return (
    <div className="flex flex-col min-h-0 w-full h-full bg-panel overflow-hidden" aria-label="Bottom dock">
      <nav className="flex items-center justify-between bg-background border-b border-border px-2 h-[28px] shrink-0" aria-label="Dock panels">
        <div className="flex gap-[2px] h-full" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={active_tab === 'assets'}
            className={tab_class('assets')}
            onClick={() => set_active_tab('assets')}
          >
            Assets
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={active_tab === 'console'}
            className={tab_class('console')}
            onClick={() => set_active_tab('console')}
          >
            Console
            {error_count > 0 && (
              <span className="bg-red-500 text-white rounded-full px-[0.35rem] text-[0.7rem] font-bold leading-[1.2]">
                {error_count}
              </span>
            )}
          </button>
        </div>
      </nav>

      <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
        <div className="flex flex-col flex-1 w-full h-full min-h-0 min-w-0" style={{ display: active_tab === 'assets' ? 'flex' : 'none' }}>
          <AssetBrowser />
        </div>
        <div className="flex flex-col flex-1 w-full h-full min-h-0 min-w-0" style={{ display: active_tab === 'console' ? 'flex' : 'none' }}>
          <Console />
        </div>
      </div>
    </div>
  )
}
