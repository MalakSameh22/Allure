import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const WISHLIST_KEY = '@allure/wishlist'

export function getWishlistItemId(product) {
  return product?.product_id ?? product?.id ?? product?.ProductID ?? product?.uuid ?? product?.product_name ?? product?.name
}

async function loadFromStorage() {
  try {
    const raw = await AsyncStorage.getItem(WISHLIST_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function saveToStorage(data) {
  try {
    await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(data))
  } catch {}
}

const WishlistContext = createContext(null)

export function WishlistProvider({ children }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    loadFromStorage().then(setItems)
  }, [])

  const toggleItem = useCallback((product) => {
    const id = getWishlistItemId(product)
    setItems((prev) => {
      const exists = prev.some((p) => getWishlistItemId(p) === id)
      const next = exists
        ? prev.filter((p) => getWishlistItemId(p) !== id)
        : [...prev, product]
      saveToStorage(next)
      return next
    })
  }, [])

  const isWishlisted = useCallback(
    (productId) => items.some((p) => getWishlistItemId(p) === productId),
    [items]
  )

  const removeItem = useCallback((productId) => {
    setItems((prev) => {
      const next = prev.filter((p) => getWishlistItemId(p) !== productId)
      saveToStorage(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ items, toggleItem, isWishlisted, removeItem }),
    [items, toggleItem, isWishlisted, removeItem]
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider')
  return ctx
}
