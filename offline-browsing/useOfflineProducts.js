import { useCallback, useEffect, useState } from 'react'
import * as Network from 'expo-network'
import { supabase } from '../lib/supabase'
import { useBatteryAwareSync } from '../hooks/useBatteryAwareSync'
import { getProductId, loadProductsCache, saveProductsCache } from './productCache'

export function useOfflineProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [syncPausedBattery, setSyncPausedBattery] = useState(false)
  const [error, setError] = useState('')
  const batterySync = useBatteryAwareSync()

  const loadProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const netState = await Network.getNetworkStateAsync()
    const offline =
      netState.isConnected === false ||
      netState.isInternetReachable === false ||
      netState.type === Network.NetworkStateType.NONE

    if (offline || batterySync.shouldPauseSync) {
      const cached = await loadProductsCache()
      setProducts(cached ?? [])
      setIsOffline(offline)
      setSyncPausedBattery(batterySync.shouldPauseSync)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')

    setLoading(false)
    setRefreshing(false)

    if (error) {
      setError(error.message)
      const cached = await loadProductsCache()
      if (cached) setProducts(cached)
      return
    }

    setError('')
    setIsOffline(false)
    setSyncPausedBattery(false)
    setProducts(data ?? [])
    saveProductsCache(data ?? [])
  }, [batterySync.shouldPauseSync])

  useEffect(() => {
    const subscription = Network.addNetworkStateListener((state) => {
      setIsOffline(
        state.isConnected === false ||
          state.isInternetReachable === false ||
          state.type === Network.NetworkStateType.NONE
      )
    })
    loadProducts()
    return () => subscription.remove()
  }, [loadProducts])

  async function removeProduct(product) {
    const productId = getProductId(product)
    if (!productId) throw new Error('Could not find this product id.')

    const { error } = await supabase.from('products').delete().eq(getProductKey(product), productId)
    if (error) throw error

    const next = products.filter((item) => getProductId(item) !== productId)
    setProducts(next)
    await saveProductsCache(next)
  }

  async function updateProductImage(product, imageUri) {
    const productId = getProductId(product)
    if (!productId) throw new Error('Could not find this product id.')

    const { data, error } = await supabase
      .from('products')
      .update({ Image: imageUri })
      .eq(getProductKey(product), productId)
      .select('*')
      .single()

    if (error) throw error

    const next = products.map((item) =>
      getProductId(item) === productId ? { ...item, ...(data ?? {}), Image: imageUri } : item
    )
    setProducts(next)
    await saveProductsCache(next)
    return data ?? { ...product, Image: imageUri }
  }

  return {
    products,
    loading,
    refreshing,
    isOffline,
    syncPausedBattery,
    error,
    reload: loadProducts,
    removeProduct,
    updateProductImage,
  }
}

function getProductKey(product) {
  if (product?.product_id !== undefined) return 'product_id'
  if (product?.id !== undefined) return 'id'
  if (product?.ProductID !== undefined) return 'ProductID'
  return 'uuid'
}
