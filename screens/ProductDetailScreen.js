import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { formatLocalizedPrice, useI18n } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { useWishlist } from '../lib/wishlist'
import { hapticAddToCart } from '../lib/haptics'
import { addRecentlyViewedProduct } from '../offline-browsing/productCache'
import { getProductStockStatus, useRealtimeStock } from '../hooks/useRealtimeStock'

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams()
  const colorScheme = useColorScheme()
  const i18n = useI18n()
  const { t } = i18n
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme
  const styles = useMemo(() => createStyles(theme), [theme])
  const { addItem, isInCart } = useCart()
  const { toggleItem, isWishlisted } = useWishlist()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const productSeed = useMemo(() => (product ? [product] : []), [product])
  const liveProducts = useRealtimeStock(productSeed)
  const liveProduct = liveProducts[0] ?? product
  const productId = getProductId(liveProduct)
  const deepLink = useMemo(
    () => (id ? Linking.createURL(`/product/${id}`) : ''),
    [id]
  )

  const loadProduct = useCallback(async () => {
    if (!id) return

    setLoading(true)
    const { data, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('product_id', id)
      .single()

    setLoading(false)

    if (productError) {
      setError(productError.message)
      return
    }

    setError('')
    setProduct(data)
    await addRecentlyViewedProduct(data)
  }, [id])

  useEffect(() => {
    loadProduct()
  }, [loadProduct])

  function addToCart() {
    if (!liveProduct) return
    hapticAddToCart()
    addItem(liveProduct)
    Alert.alert(t('addToCart'), `${getProductName(liveProduct)} added to cart.`)
  }

  async function shareProductLink() {
    if (!deepLink) return
    try {
      await Share.share({
        message: `${getProductName(liveProduct)}\n${deepLink}`,
        url: deepLink,
      })
    } catch {
      Alert.alert('Product link', deepLink)
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.text} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !liveProduct) {
    return (
      <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.messageTitle}>{t('couldNotLoadProducts')}</Text>
          <Text style={styles.messageText}>{error || 'Product not found.'}</Text>
          <Pressable onPress={loadProduct} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('tryAgain')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const imageUrl = getProductImage(liveProduct)
  const stockStatus = getProductStockStatus(liveProduct)
  const wishlisted = isWishlisted(productId)
  const inCart = isInCart(productId)

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable onPress={shareProductLink} style={styles.iconButton} hitSlop={8}>
              <Ionicons name="share-outline" size={21} color={theme.text} />
            </Pressable>
            <Pressable onPress={() => toggleItem(liveProduct)} style={styles.iconButton} hitSlop={8}>
              <Ionicons
                name={wishlisted ? 'heart' : 'heart-outline'}
                size={22}
                color={wishlisted ? '#e8324a' : theme.text}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <Text style={styles.placeholderText}>Allure</Text>
          )}
        </View>

        <Text style={styles.category}>{getProductCategory(liveProduct)}</Text>
        <Text style={styles.title}>{getProductName(liveProduct)}</Text>
        <Text style={styles.price}>
          {formatLocalizedPrice(liveProduct.price ?? liveProduct.sale_price ?? liveProduct.amount, i18n)}
        </Text>
        {stockStatus ? (
          <Text style={[styles.stock, stockStatus.isOut && styles.stockOut]}>
            {stockStatus.label}
          </Text>
        ) : null}

        <View style={styles.detailRow}>
          {liveProduct.brand ? <Text style={styles.detailPill}>{liveProduct.brand}</Text> : null}
          {liveProduct.color ? <Text style={styles.detailPill}>{`${t('color')} ${liveProduct.color}`}</Text> : null}
          {liveProduct.size ? <Text style={styles.detailPill}>{`${t('size')} ${liveProduct.size}`}</Text> : null}
          {liveProduct.barcode ? <Text style={styles.detailPill}>{`${t('barcode')} ${liveProduct.barcode}`}</Text> : null}
        </View>

        {getProductDescription(liveProduct) ? (
          <Text style={styles.description}>{getProductDescription(liveProduct)}</Text>
        ) : null}

        <Text style={styles.deepLinkLabel}>Deep link</Text>
        <Text selectable style={styles.deepLinkText}>{deepLink}</Text>

        <Pressable
          onPress={addToCart}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Ionicons
            name={inCart ? 'bag-check' : 'bag-add-outline'}
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.primaryButtonText}>
            {inCart ? t('addToCart') + ' (+1)' : t('addToCart')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function getProductId(product) {
  return product?.product_id ?? product?.id ?? product?.ProductID ?? product?.uuid
}

function getProductImage(product) {
  return String(
    product?.Image ??
      product?.image_url ??
      product?.imageUrl ??
      product?.image ??
      product?.photo_url ??
      product?.photoUrl ??
      ''
  ).trim()
}

function getProductName(product) {
  return (
    product?.product_name ??
    product?.ProductName ??
    product?.productName ??
    product?.name ??
    product?.Name ??
    product?.title ??
    product?.Title ??
    'Untitled product'
  )
}

function getProductCategory(product) {
  const explicit = product?.category || product?.Category || product?.type || product?.Type
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
  if (/watch|bracelet|necklace|ring|earring|jewelry|jewellery|scarf|hat|cap|belt|sunglasses/.test(n)) return 'Accessories'
  if (/suit|tuxedo|formal/.test(n)) return 'Formal'
  if (/swim|bikini/.test(n)) return 'Swimwear'
  return 'Other'
}

function getProductDescription(product) {
  const description = product?.description ?? product?.details ?? product?.subtitle
  if (description) return description
  return [product?.color, product?.size ? `Size ${product.size}` : ''].filter(Boolean).join(' - ')
}

const lightTheme = {
  screen: '#fbfaf8',
  text: '#111',
  muted: '#716b64',
  subtle: '#8a8178',
  border: '#e8e2d9',
  card: '#fff',
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
  placeholder: '#302b26',
  success: '#8fd0ad',
  danger: '#ff9a8f',
  primary: '#a98ddf',
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { backgroundColor: theme.screen, flex: 1 },
    content: { padding: 20, paddingBottom: 34 },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    headerActions: { flexDirection: 'row', gap: 8 },
    iconButton: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    imageWrap: {
      alignItems: 'center',
      aspectRatio: 0.85,
      backgroundColor: theme.placeholder,
      borderRadius: 8,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    image: { height: '100%', width: '100%' },
    placeholderText: {
      color: theme.subtle,
      fontSize: 14,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    category: {
      color: theme.subtle,
      fontSize: 12,
      fontWeight: '900',
      marginTop: 18,
      textTransform: 'uppercase',
    },
    title: { color: theme.text, fontSize: 30, fontWeight: '900', lineHeight: 36, marginTop: 5 },
    price: { color: theme.success, fontSize: 20, fontWeight: '900', marginTop: 10 },
    stock: { color: theme.primary, fontSize: 14, fontWeight: '900', marginTop: 7 },
    stockOut: { color: theme.danger },
    detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    detailPill: {
      borderColor: theme.border,
      borderRadius: 7,
      borderWidth: 1,
      color: theme.muted,
      fontSize: 12,
      fontWeight: '800',
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    description: { color: theme.muted, fontSize: 15, lineHeight: 22, marginTop: 16 },
    deepLinkLabel: {
      color: theme.subtle,
      fontSize: 12,
      fontWeight: '900',
      marginTop: 20,
      textTransform: 'uppercase',
    },
    deepLinkText: { color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: theme.primary,
      borderRadius: 8,
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 22,
      minHeight: 54,
      paddingHorizontal: 18,
    },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
    pressed: { opacity: 0.88 },
    center: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    messageTitle: { color: theme.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
    messageText: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  })
}
