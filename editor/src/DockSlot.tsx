import { useState } from 'react'
import { AssetBrowser } from './AssetBrowser'
import { Console } from './Console'
import { useConsoleStore } from './console/console_store'

export type DockTab = 'assets' | 'console'

export function DockSlot() {
  const [active_tab, set_active_tab] = useState<DockTab>('assets')
  const error_count = useConsoleStore((store) => store.error_count)

  return (
    <div className="dock-slot" aria-label="Bottom dock">
      <nav className="dock-slot-header" aria-label="Dock panels">
        <div className="dock-slot-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={active_tab === 'assets'}
            className={`dock-tab${active_tab === 'assets' ? ' active' : ''}`}
            onClick={() => set_active_tab('assets')}
          >
            Assets
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={active_tab === 'console'}
            className={`dock-tab${active_tab === 'console' ? ' active' : ''}`}
            onClick={() => set_active_tab('console')}
          >
            Console
            {error_count > 0 && <span className="dock-tab-error-badge">{error_count}</span>}
          </button>
        </div>
      </nav>

      <div className="dock-slot-body">
        <div className="dock-panel" style={{ display: active_tab === 'assets' ? 'flex' : 'none' }}>
          <AssetBrowser />
        </div>
        <div className="dock-panel" style={{ display: active_tab === 'console' ? 'flex' : 'none' }}>
          <Console />
        </div>
      </div>
    </div>
  )
}
