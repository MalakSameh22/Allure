import { useCallback, useEffect, useState } from 'react'
import * as Network from 'expo-network'
import * as FileSystem from 'expo-file-system'
import { supabase } from '../lib/supabase'
import { useBatteryAwareSync } from '../hooks/useBatteryAwareSync'

const CACHE_FILE = FileSystem.documentDirectory + 'cachedStores.json'

async function saveCache(data) {
  await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(data))
}

async function loadCache() {
  const info = await FileSystem.getInfoAsync(CACHE_FILE)
  if (!info.exists) return null

  try {
    const raw = await FileSystem.readAsStringAsync(CACHE_FILE)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function useOfflineStores() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [syncPausedBattery, setSyncPausedBattery] = useState(false)
  const [error, setError] = useState('')
  const batterySync = useBatteryAwareSync()

  const loadStores = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const netState = await Network.getNetworkStateAsync()
    const offline =
      netState.isConnected === false ||
      netState.isInternetReachable === false ||
      netState.type === Network.NetworkStateType.NONE

    if (offline || batterySync.shouldPauseSync) {
      const cached = await loadCache()
      setStores(cached ?? [])
      setIsOffline(offline)
      setSyncPausedBattery(batterySync.shouldPauseSync)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data, error } = await supabase.from('stores').select('*')

    setLoading(false)
    setRefreshing(false)

    if (error) {
      setError(error.message)
      const cached = await loadCache()
      if (cached) setStores(cached)
      return
    }

    setError('')
    setIsOffline(false)
    setSyncPausedBattery(false)
    setStores(data ?? [])
    saveCache(data ?? [])
  }, [batterySync.shouldPauseSync])

  useEffect(() => {
    const subscription = Network.addNetworkStateListener((state) => {
      setIsOffline(
        state.isConnected === false ||
          state.isInternetReachable === false ||
          state.type === Network.NetworkStateType.NONE
      )
    })
    loadStores()
    return () => subscription.remove()
  }, [loadStores])

  return { stores, loading, refreshing, isOffline, syncPausedBattery, error, reload: loadStores }
}
