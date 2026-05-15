import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

function getProductId(product) {
  return product?.product_id ?? product?.id ?? product?.ProductID ?? product?.uuid
}

export function getProductStockQuantity(product) {
  const value =
    product?.stock_quantity ??
    product?.quantity ??
    product?.stock ??
    product?.inventory_quantity ??
    product?.inventory

  if (value === null || value === undefined || value === '') return null

  const quantity = Number(value)
  return Number.isNaN(quantity) ? null : quantity
}

export function getProductStockStatus(product) {
  const quantity = getProductStockQuantity(product)
  if (quantity === null) return null
  if (quantity <= 0) return { isOut: true, label: 'Out of stock', quantity }
  if (quantity <= 5) return { isOut: false, label: `${quantity} left`, quantity }
  return { isOut: false, label: `${quantity} in stock`, quantity }
}

export function useRealtimeStock(initialProducts = [], options = {}) {
  const [products, setProducts] = useState(initialProducts)
  const channelName = useRef(`realtime-stock-${Math.random().toString(36).slice(2)}`)
  const includeNewRows = Boolean(options.includeNewRows)

  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          const updated = payload.new ?? payload.old
          const updatedId = getProductId(updated)
          if (!updatedId) return

          setProducts((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((product) => getProductId(product) !== updatedId)
            }

            const exists = prev.some((product) => getProductId(product) === updatedId)
            if (!exists) return includeNewRows ? [updated, ...prev] : prev

            return prev.map((product) =>
              getProductId(product) === updatedId ? { ...product, ...updated } : product
            )
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [includeNewRows])

  return products
}

export function useRealtimeSingleProduct(productId) {
  const [stockQuantity, setStockQuantity] = useState(null)

  useEffect(() => {
    if (!productId) return undefined

    supabase
      .from('products')
      .select('*')
      .eq('product_id', productId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setStockQuantity(getProductStockQuantity(data))
      })

    const channel = supabase
      .channel(`stock-product-${productId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `product_id=eq.${productId}`,
        },
        (payload) => {
          setStockQuantity(getProductStockQuantity(payload.new))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [productId])

  return {
    stock_quantity: stockQuantity,
    isLowStock: stockQuantity !== null && stockQuantity > 0 && stockQuantity <= 5,
    isOutOfStock: stockQuantity !== null && stockQuantity === 0,
  }
}
