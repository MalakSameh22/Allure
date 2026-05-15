import * as FileSystem from 'expo-file-system'

const PRODUCTS_CACHE_FILE = FileSystem.documentDirectory + 'cachedProducts.json'
const RECENTLY_VIEWED_FILE = FileSystem.documentDirectory + 'recentlyViewedProducts.json'
const RECENT_LIMIT = 12

async function readJsonFile(path, fallback) {
  const info = await FileSystem.getInfoAsync(path)
  if (!info.exists) return fallback

  try {
    const raw = await FileSystem.readAsStringAsync(path)
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function writeJsonFile(path, data) {
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data))
}

export async function saveProductsCache(data) {
  await writeJsonFile(PRODUCTS_CACHE_FILE, data)
}

export async function loadProductsCache() {
  return readJsonFile(PRODUCTS_CACHE_FILE, null)
}

export async function addRecentlyViewedProduct(product) {
  const recent = await getRecentlyViewedProducts()
  const productId = getProductId(product)
  const next = [
    { ...product, viewed_at: new Date().toISOString() },
    ...recent.filter((item) => getProductId(item) !== productId),
  ].slice(0, RECENT_LIMIT)

  await writeJsonFile(RECENTLY_VIEWED_FILE, next)
  return next
}

export async function getRecentlyViewedProducts() {
  return readJsonFile(RECENTLY_VIEWED_FILE, [])
}

export async function removeRecentlyViewedProduct(productId) {
  const recent = await getRecentlyViewedProducts()
  const next = recent.filter((item) => getProductId(item) !== productId)
  await writeJsonFile(RECENTLY_VIEWED_FILE, next)
  return next
}

export function getProductId(product) {
  return product?.product_id ?? product?.id ?? product?.ProductID ?? product?.uuid
}
import { useRealtimeSingleProduct } from '../hooks/useRealtimeStock';

function ProductDetailScreen({ route }) {
  const { product_id } = route.params;
  const { quantity, isLowStock, isOutOfStock } = useRealtimeSingleProduct(product_id);

  return (
    <View>
      {isOutOfStock  && <Text style={{ color: 'red' }}>Out of Stock</Text>}
      {isLowStock    && <Text style={{ color: 'orange' }}>Only {quantity} left!</Text>}
      {!isOutOfStock && !isLowStock && <Text style={{ color: 'green' }}>{quantity} in stock</Text>}

      <TouchableOpacity disabled={isOutOfStock} onPress={() => addToCart(product)}>
        <Text>{isOutOfStock ? 'Unavailable' : 'Add to Cart'}</Text>
      </TouchableOpacity>
    </View>
  );
}