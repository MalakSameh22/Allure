import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as ImagePicker from 'expo-image-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { formatLocalizedPrice, useI18n } from '../lib/i18n'
import { useCart, getCartItemId } from '../lib/cart'
import { useWishlist, getWishlistItemId } from '../lib/wishlist'
import { useOfflineProducts } from '../offline-browsing/useOfflineProducts'
import { addRecentlyViewedProduct } from '../offline-browsing/productCache'
import { getProductStockStatus, useRealtimeStock } from '../hooks/useRealtimeStock'
import { hapticAddToCart, hapticSwipeAction } from '../lib/haptics'

export default function HomeScreen() {
  const colorScheme = useColorScheme()
  const i18n = useI18n()
  const { t } = i18n
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme
  const styles = useMemo(() => createStyles(theme), [theme])
  const { totalItems } = useCart()
  const {
    products,
    loading,
    refreshing,
    isOffline,
    syncPausedBattery,
    error,
    reload,
    removeProduct,
    updateProductImage,
  } = useOfflineProducts()
  const liveProducts = useRealtimeStock(products, { includeNewRows: true })
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const didInitialFocus = useRef(false)

  const categories = useMemo(() => {
    const values = liveProducts
      .map((p) => getProductCategory(p))
      .filter(Boolean)
      .filter((v, i, arr) => arr.findIndex((x) => normalize(x) === normalize(v)) === i)
    const withoutOther = values.filter((v) => normalize(v) !== 'other')
    // Always append Others tab at the end regardless of whether any product explicitly has it
    return [t('all'), ...withoutOther, t('other')]
  }, [liveProducts, t])

  const visibleProducts = useMemo(() => {
    if (normalize(selectedCategory) === 'all' || selectedCategory === t('all')) return liveProducts
    return liveProducts.filter(
      (p) => normalize(getProductCategory(p)) === normalize(selectedCategory)
    )
  }, [liveProducts, selectedCategory, t])

  const catalogRows = useMemo(() => createCatalogRows(visibleProducts), [visibleProducts])
  const selectedLiveProduct = useMemo(() => {
    if (!selectedProduct) return null
    const selectedId = getProductId(selectedProduct)
    return liveProducts.find((product) => getProductId(product) === selectedId) ?? selectedProduct
  }, [liveProducts, selectedProduct])

  useFocusEffect(
    useCallback(() => {
      if (didInitialFocus.current) {
        reload(false)
      } else {
        didInitialFocus.current = true
      }
    }, [reload])
  )

  async function openProduct(product) {
    const productId = getProductId(product)
    await addRecentlyViewedProduct(product)
    if (productId) {
      router.push(`/product/${productId}`)
      return
    }
    setSelectedProduct(product)
  }

  async function pickImageForProduct() {
    if (!selectedProduct) return

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('permissionNeeded'), t('photoPermissionHelp'))
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    })

    if (result.canceled || result.assets.length === 0) return

    try {
      setActionLoading(true)
      const updated = await updateProductImage(selectedProduct, result.assets[0].uri)
      setSelectedProduct(updated)
      await addRecentlyViewedProduct(updated)
    } catch (err) {
      Alert.alert(t('couldNotUpdateImage'), err.message)
    } finally {
      setActionLoading(false)
    }
  }

  function confirmRemoveProduct() {
    if (!selectedProduct) return

    Alert.alert(t('removeProduct'), t('removeProductBody'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: t('remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            setActionLoading(true)
            await removeProduct(selectedProduct)
            setSelectedProduct(null)
          } catch (err) {
            Alert.alert(t('couldNotRemoveProduct'), err.message)
          } finally {
            setActionLoading(false)
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>{t('offlineProducts')}</Text>
        </View>
      )}
      {syncPausedBattery && (
        <View style={styles.batteryBanner}>
          <Text style={styles.batteryBannerText}>
            Sync paused to conserve battery
          </Text>
        </View>
      )}

      <FlatList
        data={catalogRows}
        keyExtractor={(item, index) => item.id ?? String(index)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload(true)}
            tintColor={theme.text}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View>
                <Text style={styles.kicker}>{t('newSeasonEdit')}</Text>
                <Text style={styles.title}>Allure</Text>
              </View>
              <Pressable
                onPress={() => router.push('/cart')}
                style={({ pressed }) => [styles.cartButton, pressed && styles.cardPressed]}
              >
                <Ionicons name="bag-outline" size={24} color={theme.text} />
                {totalItems > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>
                      {totalItems > 9 ? '9+' : String(totalItems)}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            <View style={styles.hero}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>{t('heroTitle')}</Text>
                <Text style={styles.heroText}>{t('shopHero')}</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            >
              {categories.map((category) => {
                const active =
                  normalize(selectedCategory) === normalize(category)
                return (
                  <Pressable
                    key={category}
                    onPress={() => setSelectedCategory(category)}
                    style={[styles.categoryButton, active && styles.categoryButtonActive]}
                  >
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                      {category}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('products')}</Text>
              <Text style={styles.productCount}>{visibleProducts.length} {t('items')}</Text>
            </View>

            {error ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageTitle}>{t('couldNotLoadProducts')}</Text>
                <Text style={styles.messageText}>{error}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={theme.text} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.messageTitle}>{t('noProducts')}</Text>
              <Text style={styles.messageText}>{t('noProductsHelp')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          if (item.kind === 'category') {
            return (
              <View style={styles.categorySectionHeader}>
                <Text style={styles.categorySectionTitle}>{item.title}</Text>
                <Text style={styles.categorySectionCount}>{item.count} {t('items')}</Text>
              </View>
            )
          }

          return (
            <View style={styles.productRow}>
              {item.products.map((product) => (
                <ProductCard
                  i18n={i18n}
                  key={String(getProductId(product) ?? getProductName(product))}
                  product={product}
                  styles={styles}
                  theme={theme}
                  onPress={() => openProduct(product)}
                />
              ))}
              {item.products.length === 1 ? <View style={styles.productCardSpacer} /> : null}
            </View>
          )
        }}
      />

      <ProductModal
        actionLoading={actionLoading}
        onClose={() => setSelectedProduct(null)}
        onPickImage={pickImageForProduct}
        onRemove={confirmRemoveProduct}
        product={selectedLiveProduct}
        styles={styles}
        theme={theme}
        i18n={i18n}
      />
    </SafeAreaView>
  )
}

function ProductCard({ i18n, product, styles, theme, onPress }) {
  const { t } = i18n
  const { toggleItem, isWishlisted } = useWishlist()
  const { addItem, isInCart } = useCart()
  const imageUrl = getProductImage(product)
  const name = getProductName(product)
  const category = getProductCategory(product)
  const description = getProductDescription(product)
  const price = product.price ?? product.sale_price ?? product.amount
  const stockStatus = getStockStatus(product)
  const productId = getProductId(product)
  const wishlisted = isWishlisted(productId)
  const inCart = isInCart(productId)

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.productCard, pressed && styles.cardPressed]}
    >
      <View style={styles.productImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productImage} />
        ) : (
          <View style={styles.productPlaceholder}>
            <Text style={styles.productPlaceholderText}>Allure</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={() => toggleItem(product)}
          style={[styles.wishlistBadge, wishlisted && styles.wishlistBadgeActive]}
          activeOpacity={0.75}
        >
          <Ionicons
            name={wishlisted ? 'heart' : 'heart-outline'}
            size={18}
            color={wishlisted ? '#e8324a' : '#fff'}
          />
        </TouchableOpacity>
        <View style={styles.productBadge}>
          <Text style={styles.productBadgeText}>{t('view')}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={styles.productCategory}>{category}</Text>
      <Text numberOfLines={2} style={styles.productName}>{name}</Text>
      {description ? (
        <Text numberOfLines={2} style={styles.productDescription}>{description}</Text>
      ) : null}
      {stockStatus ? (
        <Text style={[styles.stockText, stockStatus.isOut && styles.stockTextOut]}>
          {stockStatus.label}
        </Text>
      ) : null}
      <Text style={styles.productPrice}>{formatLocalizedPrice(price, i18n)}</Text>
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation?.()
          hapticAddToCart()
          addItem(product)
          Alert.alert(t('addToCart'), `${name} added to cart.`)
        }}
        style={[styles.quickAddButton, inCart && styles.quickAddButtonActive]}
        activeOpacity={0.8}
      >
        <Ionicons
          name={inCart ? 'bag-check' : 'bag-add-outline'}
          size={13}
          color={inCart ? '#fff' : theme.primary}
          style={{ marginRight: 4 }}
        />
        <Text style={[styles.quickAddText, inCart && styles.quickAddTextActive]}>
          {inCart ? t('addToCart') + ' +1' : t('addToCart')}
        </Text>
      </TouchableOpacity>
    </Pressable>
  )
}

function ProductModal({ actionLoading, i18n, onClose, onPickImage, onRemove, product, styles, theme }) {
  const { t } = i18n
  const { addItem, isInCart } = useCart()
  const { toggleItem, isWishlisted } = useWishlist()

  if (!product) return null

  const imageUrl = getProductImage(product)
  const productId = getProductId(product)
  const stockStatus = getStockStatus(product)
  const wishlisted = isWishlisted(productId)
  const inCart = isInCart(productId)

  const details = [
    getProductCategory(product),
    product.color ? `${t('color')} ${product.color}` : '',
    product.size ? `${t('size')} ${product.size}` : '',
    product.barcode ? `${t('barcode')} ${product.barcode}` : '',
  ].filter(Boolean)

  return (
    <Modal animationType="slide" transparent visible={Boolean(product)} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailImageWrap}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.detailImage} />
              ) : (
                <View style={styles.productPlaceholder}>
                  <Text style={styles.productPlaceholderText}>Allure</Text>
                </View>
              )}
              <Pressable
                onPress={() => toggleItem(product)}
                style={styles.detailWishlistButton}
                hitSlop={8}
              >
                <Ionicons
                  name={wishlisted ? 'heart' : 'heart-outline'}
                  size={22}
                  color={wishlisted ? '#e8324a' : theme.muted}
                />
              </Pressable>
            </View>
            <Text style={styles.productCategory}>{details.join('  /  ')}</Text>
            <Text style={styles.detailTitle}>{getProductName(product)}</Text>
            <Text style={styles.detailPrice}>
              {formatLocalizedPrice(product.price ?? product.sale_price ?? product.amount, i18n)}
            </Text>
            {stockStatus ? (
              <Text style={[styles.detailStock, stockStatus.isOut && styles.stockTextOut]}>
                {stockStatus.label}
              </Text>
            ) : null}
            {getProductDescription(product) ? (
              <Text style={styles.detailText}>{getProductDescription(product)}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  hapticAddToCart()
                  addItem(product)
                  Alert.alert(t('addToCart'), `${getProductName(product)} added to cart.`)
                }}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.cardPressed]}
              >
                <Ionicons name={inCart ? 'bag-check' : 'bag-add-outline'} size={18} color={theme.screen} style={{ marginRight: 6 }} />
                <Text style={styles.primaryButtonText}>
                  {inCart ? t('addToCart') + ' (+1)' : t('addToCart')}
                </Text>
              </Pressable>
              <Pressable
                disabled={actionLoading}
                onPress={onPickImage}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.cardPressed]}
              >
                <Text style={styles.secondaryButtonText}>
                  {actionLoading ? t('working') : t('addImage')}
                </Text>
              </Pressable>
              <Pressable
                disabled={actionLoading}
                onPress={() => {
                  hapticSwipeAction()
                  onRemove()
                }}
                style={({ pressed }) => [styles.dangerButton, pressed && styles.cardPressed]}
              >
                <Text style={styles.dangerButtonText}>{t('removeProduct')}</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.messageText, { color: theme.muted }]}>{t('close')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function getProductId(product) {
  return product?.product_id ?? product?.id ?? product?.ProductID ?? product?.uuid
}

function getProductImage(product) {
  return String(
    product.Image ??
      product.image_url ??
      product.imageUrl ??
      product.image ??
      product.photo_url ??
      product.photoUrl ??
      ''
  ).trim()
}

function getProductName(product) {
  return (
    product.product_name ??
    product.ProductName ??
    product.productName ??
    product.name ??
    product.Name ??
    product.title ??
    product.Title ??
    'Untitled product'
  )
}

function getProductCategory(product) {
  const explicit = product.category || product.Category || product.type || product.Type
  if (explicit) return explicit
  return inferCategoryFromName(getProductName(product))
}

function inferCategoryFromName(name) {
  if (!name) return 'Other'
  const n = name.toLowerCase()
  if (/dress|skirt|gown|maxi|midi|mini/.test(n)) return 'Dresses'
  if (/jacket|coat|blazer|hoodie|sweater|cardigan|pullover/.test(n)) return 'Outerwear'
  if (/jeans|pants|trousers|shorts|legging/.test(n)) return 'Bottoms'
  if (/shirt|blouse|tee|t-shirt|tank|crop|top/.test(n)) return 'Tops'
  if (/shoe|boot|sneaker|heel|sandal|loafer|flat/.test(n)) return 'Shoes'
  if (/bag|purse|wallet|clutch|backpack|tote/.test(n)) return 'Bags'
  if (/watch|bracelet|necklace|ring|earring|jewelry|jewellery/.test(n)) return 'Accessories'
  if (/scarf|hat|cap|belt|sunglasses|glasses/.test(n)) return 'Accessories'
  if (/suit|tuxedo|formal/.test(n)) return 'Formal'
  if (/swim|bikini/.test(n)) return 'Swimwear'
  return 'Other'
}

function getProductDescription(product) {
  const description = product.description ?? product.details ?? product.subtitle
  if (description) return description
  return [product.color, product.size ? `Size ${product.size}` : ''].filter(Boolean).join(' - ')
}

function getStockStatus(product) {
  return getProductStockStatus(product)
}

function createCatalogRows(products) {
  return groupProductsByCategory(products).flatMap((section) => {
    const productRows = []
    for (let i = 0; i < section.products.length; i += 2) {
      productRows.push({
        id: `products-${section.key}-${i}`,
        kind: 'products',
        products: section.products.slice(i, i + 2),
      })
    }

    return [
      {
        count: section.products.length,
        id: `category-${section.key}`,
        kind: 'category',
        title: section.title,
      },
      ...productRows,
    ]
  })
}

function groupProductsByCategory(products) {
  const groups = new Map()

  products.forEach((product) => {
    const title = getProductCategory(product) || 'Other'
    const key = normalize(title) || 'other'

    if (!groups.has(key)) {
      groups.set(key, { key, products: [], title })
    }
    groups.get(key).products.push(product)
  })

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      products: [...group.products].sort(compareProductsByName),
    }))
    .sort((a, b) => {
      if (a.key === 'other') return 1
      if (b.key === 'other') return -1
      return a.title.localeCompare(b.title)
    })
}

function compareProductsByName(a, b) {
  return getProductName(a).localeCompare(getProductName(b))
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

const lightTheme = {
  screen: '#fbfaf8',
  text: '#111',
  muted: '#716b64',
  subtle: '#8a8178',
  border: '#e8e2d9',
  card: '#fff',
  hero: '#1d1a18',
  heroText: '#ded8cf',
  chip: '#fff',
  placeholder: '#eee7dc',
  success: '#2c5c4a',
  danger: '#b42318',
  primary: '#6849a7',
}

const darkTheme = {
  screen: '#151515',
  text: '#f5f1ea',
  muted: '#c8bfb3',
  subtle: '#9b9187',
  border: '#3a342e',
  card: '#211f1d',
  hero: '#070707',
  heroText: '#c8bfb3',
  chip: '#2b2825',
  placeholder: '#302b26',
  success: '#8fd0ad',
  danger: '#ff9a8f',
  primary: '#a98ddf',
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { backgroundColor: theme.screen, flex: 1 },
    offlineBanner: {
      backgroundColor: theme.hero,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    offlineBannerText: {
      color: theme.heroText,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    batteryBanner: {
      backgroundColor: theme.card,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    batteryBannerText: {
      color: theme.danger,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
    content: { paddingBottom: 28, paddingHorizontal: 18, paddingTop: 12 },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    kicker: {
      color: theme.subtle,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    title: { color: theme.text, fontSize: 30, fontWeight: '900', letterSpacing: 0 },
    cartButton: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
      position: 'relative',
    },
    cartBadge: {
      alignItems: 'center',
      backgroundColor: '#e8324a',
      borderRadius: 9,
      height: 18,
      justifyContent: 'center',
      minWidth: 18,
      paddingHorizontal: 4,
      position: 'absolute',
      right: -2,
      top: -2,
    },
    cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    hero: {
      backgroundColor: theme.hero,
      borderRadius: 8,
      minHeight: 158,
      justifyContent: 'flex-end',
      marginBottom: 18,
      overflow: 'hidden',
      padding: 18,
    },
    heroCopy: { maxWidth: 310 },
    heroTitle: { color: '#fff', fontSize: 25, fontWeight: '900', lineHeight: 31 },
    heroText: { color: theme.heroText, fontSize: 14, lineHeight: 20, marginTop: 8 },
    categoryList: { gap: 8, paddingBottom: 18 },
    categoryButton: {
      backgroundColor: theme.chip,
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    categoryButtonActive: { backgroundColor: theme.text, borderColor: theme.text },
    categoryText: { color: theme.muted, fontSize: 14, fontWeight: '800' },
    categoryTextActive: { color: theme.screen },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: { color: theme.text, fontSize: 22, fontWeight: '900' },
    productCount: { color: theme.subtle, fontSize: 13, fontWeight: '700' },
    categorySectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
      marginTop: 8,
    },
    categorySectionTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
    },
    categorySectionCount: {
      color: theme.subtle,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    productRow: { flexDirection: 'row', gap: 12 },
    productCard: { flex: 1, marginBottom: 18, maxWidth: '48.5%' },
    productCardSpacer: { flex: 1, maxWidth: '48.5%' },
    cardPressed: { opacity: 0.88 },
    productImageWrap: {
      aspectRatio: 0.78,
      backgroundColor: theme.placeholder,
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    productImage: { height: '100%', width: '100%' },
    productPlaceholder: {
      alignItems: 'center',
      backgroundColor: theme.placeholder,
      flex: 1,
      justifyContent: 'center',
    },
    productPlaceholderText: {
      color: theme.subtle,
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    wishlistBadge: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.38)',
      borderRadius: 8,
      height: 32,
      justifyContent: 'center',
      left: 8,
      position: 'absolute',
      top: 8,
      width: 32,
    },
    wishlistBadgeActive: {
      backgroundColor: 'rgba(255,255,255,0.92)',
    },
    productBadge: {
      backgroundColor: theme.card,
      borderRadius: 6,
      minHeight: 26,
      justifyContent: 'center',
      paddingHorizontal: 9,
      position: 'absolute',
      right: 8,
      top: 8,
    },
    productBadgeText: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    productCategory: {
      color: theme.subtle,
      fontSize: 12,
      fontWeight: '800',
      marginTop: 10,
      textTransform: 'uppercase',
    },
    productName: { color: theme.text, fontSize: 15, fontWeight: '800', lineHeight: 20, marginTop: 4 },
    productDescription: { color: theme.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
    stockText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: '900',
      marginTop: 5,
    },
    stockTextOut: {
      color: theme.danger,
    },
    productPrice: { color: theme.success, fontSize: 14, fontWeight: '900', marginTop: 6 },
    quickAddButton: {
      alignItems: 'center',
      borderColor: theme.primary,
      borderRadius: 6,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 8,
      minHeight: 30,
      paddingHorizontal: 8,
    },
    quickAddButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    quickAddText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: '800',
    },
    quickAddTextActive: {
      color: '#fff',
    },
    messageBox: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 14,
      padding: 14,
    },
    emptyState: {
      alignItems: 'center',
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      minHeight: 140,
      justifyContent: 'center',
      padding: 18,
    },
    messageTitle: { color: theme.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
    messageText: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
    modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.55)', flex: 1, justifyContent: 'flex-end' },
    modalPanel: {
      backgroundColor: theme.screen,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '90%',
      padding: 20,
    },
    detailImageWrap: {
      aspectRatio: 0.9,
      backgroundColor: theme.placeholder,
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    detailImage: { height: '100%', width: '100%' },
    detailWishlistButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      position: 'absolute',
      right: 12,
      top: 12,
      width: 40,
    },
    detailTitle: { color: theme.text, fontSize: 28, fontWeight: '900', marginTop: 8 },
    detailPrice: { color: theme.success, fontSize: 18, fontWeight: '900', marginTop: 8 },
    detailStock: { color: theme.primary, fontSize: 14, fontWeight: '900', marginTop: 6 },
    detailText: { color: theme.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
    modalActions: { gap: 10, marginTop: 20, paddingBottom: 14 },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: theme.primary,
      borderRadius: 8,
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: 52,
    },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
    secondaryButton: {
      alignItems: 'center',
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 52,
    },
    secondaryButtonText: { color: theme.text, fontSize: 15, fontWeight: '900' },
    dangerButton: {
      alignItems: 'center',
      borderColor: theme.danger,
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 52,
    },
    dangerButtonText: { color: theme.danger, fontSize: 15, fontWeight: '900' },
    closeButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  })
}
