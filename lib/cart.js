import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'

const CART_KEY = '@allure/cart'

export function getCartItemId(product) {
  return product?.product_id ?? product?.id ?? product?.ProductID ?? product?.uuid ?? product?.product_name ?? product?.name
}

function cartReducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return action.items ?? []
    case 'ADD': {
      const id = getCartItemId(action.product)
      const idx = state.findIndex((item) => getCartItemId(item.product) === id)
      if (idx >= 0) {
        return state.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...state, { product: action.product, quantity: 1 }]
    }
    case 'REMOVE':
      return state.filter((item) => getCartItemId(item.product) !== action.productId)
    case 'UPDATE_QTY':
      if (action.quantity <= 0) {
        return state.filter((item) => getCartItemId(item.product) !== action.productId)
      }
      return state.map((item) =>
        getCartItemId(item.product) === action.productId
          ? { ...item, quantity: action.quantity }
          : item
      )
    case 'CLEAR':
      return []
    default:
      return state
  }
}

async function loadFromStorage() {
  try {
    const raw = await AsyncStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function saveToStorage(data) {
  try {
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(data))
  } catch {}
}

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, [])

  useEffect(() => {
    loadFromStorage().then((loaded) => dispatch({ type: 'LOAD', items: loaded }))
  }, [])

  useEffect(() => {
    saveToStorage(items)
  }, [items])

  const addItem = useCallback((product) => dispatch({ type: 'ADD', product }), [])
  const removeItem = useCallback((productId) => dispatch({ type: 'REMOVE', productId }), [])
  const updateQuantity = useCallback(
    (productId, quantity) => dispatch({ type: 'UPDATE_QTY', productId, quantity }),
    []
  )
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), [])

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  )

  const totalPrice = useMemo(
    () =>
      items.reduce((sum, item) => {
        const price = Number(
          item.product.price ?? item.product.sale_price ?? item.product.amount ?? 0
        )
        return sum + price * item.quantity
      }, 0),
    [items]
  )

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      isInCart: (productId) =>
        items.some((item) => getCartItemId(item.product) === productId),
    }),
    [items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
