import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import { useAssetStore, type AssetStore, type AssetStoreHook } from './project/asset_store'

// The asset browser shows several project folders, each with its own store; its parts read the one they belong to.
export const AssetBrowserContext = createContext<AssetStoreHook>(useAssetStore)

export function useBrowserStore<T>(selector: (store: AssetStore) => T): T {
  return useStore(useContext(AssetBrowserContext), selector)
}
