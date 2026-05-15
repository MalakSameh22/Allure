import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Appearance,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { formatLocalizedPrice, useI18n, REGIONS } from '../lib/i18n'
import { useWishlist, getWishlistItemId } from '../lib/wishlist'
import { useCart, getCartItemId } from '../lib/cart'
import { hapticAddToCart, hapticSwipeAction } from '../lib/haptics'
import { getProductStockStatus, useRealtimeStock } from '../hooks/useRealtimeStock'

export default function ProfileScreen() {
  const colorScheme = useColorScheme()
  const i18n = useI18n()
  const { t } = i18n
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme
  const styles = useMemo(() => createStyles(theme), [theme])
  const { items: wishlistItems, removeItem: removeFromWishlist } = useWishlist()
  const { addItem: addToCart } = useCart()
  const [user, setUser] = useState(null)
  const [signingOut, setSigningOut] = useState(false)
  const [showRegionPicker, setShowRegionPicker] = useState(false)
  const liveWishlistItems = useRealtimeStock(wishlistItems)

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getUser().then(({ data }) => setUser(data.user))
    }, [])
  )

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
  }

  function toggleTheme() {
    if (typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
    }
  }

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : '?'

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.kicker}>{t('yourAccount')}</Text>
          <Text style={styles.title}>{t('profile')}</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {user ? (
            <Text style={styles.email}>{user.email}</Text>
          ) : (
            <ActivityIndicator color={theme.text} style={{ marginTop: 12 }} />
          )}
        </View>

        {/* Settings card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('memberSince')}</Text>
            <Text style={styles.rowValue}>
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString(i18n.localeTag, {
                    year: 'numeric',
                    month: 'long',
                  })
                : '-'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('theme')}</Text>
            <Pressable onPress={toggleTheme} style={styles.chipButton}>
              <Text style={styles.chipButtonText}>
                {colorScheme === 'dark' ? t('lightMode') : t('darkMode')}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.row, styles.lastRow]}>
            <Text style={styles.rowLabel}>{t('region')}</Text>
            <Pressable
              onPress={() => setShowRegionPicker(true)}
              style={styles.regionRow}
            >
              <Text style={styles.regionFlag}>{i18n.region.flag}</Text>
              <View style={styles.regionInfo}>
                <Text style={styles.regionName}>{i18n.region.label}</Text>
                <Text style={styles.regionCurrency}>
                  {i18n.currencyCode} {i18n.currencySymbol}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.subtle} />
            </Pressable>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsCard}>
          <Pressable
            onPress={() => router.push('/orders')}
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="receipt-outline" size={18} color={theme.primary} />
            </View>
            <Text style={styles.actionLabel}>{t('orderHistory')}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.subtle} style={styles.actionChevron} />
          </Pressable>
        </View>

        {/* Wishlist section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('wishlist')}</Text>
          <Text style={styles.sectionMeta}>{liveWishlistItems.length} {t('items')}</Text>
        </View>

        {liveWishlistItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('noWishlist')}</Text>
            <Text style={styles.emptyText}>{t('noWishlistHelp')}</Text>
          </View>
        ) : (
          <FlatList
            data={liveWishlistItems}
            keyExtractor={(item, idx) => String(getProductId(item) ?? idx)}
            horizontal={false}
            scrollEnabled={false}
            contentContainerStyle={styles.recentList}
            renderItem={({ item }) => (
              <WishlistCard
                item={item}
                i18n={i18n}
                styles={styles}
                theme={theme}
                onRemove={() => {
                  hapticSwipeAction()
                  removeFromWishlist(getWishlistItemId(item))
                  Alert.alert('Removed', `${getProductName(item)} removed from wishlist.`)
                }}
                onAddToCart={() => {
                  hapticAddToCart()
                  addToCart(item)
                  Alert.alert(t('addToCart'), `${getProductName(item)} added to cart.`)
                }}
              />
            )}
          />
        )}

        {/* Sign out */}
        <View style={styles.footer}>
          <Pressable
            disabled={signingOut}
            onPress={signOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.pressed,
              signingOut && styles.disabled,
            ]}
          >
            {signingOut ? (
              <ActivityIndicator color={theme.screen} />
            ) : (
              <Text style={styles.signOutText}>{t('signOut')}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Region picker modal */}
      <RegionPickerModal
        visible={showRegionPicker}
        currentRegion={i18n.region}
        onSelect={(r) => { i18n.setRegion(r); setShowRegionPicker(false) }}
        onClose={() => setShowRegionPicker(false)}
        styles={styles}
        theme={theme}
        t={t}
      />
    </SafeAreaView>
  )
}

// ─── sub-components ──────────────────────────────────────────────────────────

function WishlistCard({ item, i18n, styles, theme, onRemove, onAddToCart }) {
  const { t } = i18n
  const { isInCart } = useCart()
  const productId = getProductId(item)
  const inCart = isInCart(productId)
  const imageUrl = getProductImage(item)
  const stockStatus = getProductStockStatus(item)
  return (
    <View style={styles.recentCard}>
      <View style={styles.recentImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.recentImage} />
        ) : (
          <Text style={styles.placeholderText}>Allure</Text>
        )}
      </View>
      <View style={styles.recentBody}>
        <Text numberOfLines={1} style={styles.recentCategory}>{getProductCategory(item)}</Text>
        <Text numberOfLines={2} style={styles.recentName}>{getProductName(item)}</Text>
        {stockStatus ? (
          <Text style={[styles.recentStock, stockStatus.isOut && styles.recentStockOut]}>
            {stockStatus.label}
          </Text>
        ) : null}
        <Text style={styles.recentPrice}>
          {formatLocalizedPrice(item.price ?? item.sale_price ?? item.amount, i18n)}
        </Text>
        <TouchableOpacity
          onPress={onAddToCart}
          style={[styles.wishlistCartBtn, inCart && styles.wishlistCartBtnActive]}
          activeOpacity={0.8}
        >
          <Ionicons
            name={inCart ? 'bag-check' : 'bag-add-outline'}
            size={12}
            color={inCart ? '#fff' : theme.primary}
            style={{ marginRight: 3 }}
          />
          <Text style={[styles.wishlistCartBtnText, inCart && styles.wishlistCartBtnTextActive]}>
            {inCart ? t('addToCart') + ' +1' : t('addToCart')}
          </Text>
        </TouchableOpacity>
      </View>
      <Pressable onPress={onRemove} style={styles.removeButton} hitSlop={8}>
        <Ionicons name="heart" size={18} color="#e8324a" />
      </Pressable>
    </View>
  )
}

function RegionPickerModal({ visible, currentRegion, onSelect, onClose, styles, theme, t }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.regionModal} onPress={() => {}}>
          <View style={styles.regionModalHandle} />
          <Text style={styles.regionModalTitle}>{t('selectRegion')}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {REGIONS.map((region) => {
              const active = region.code === currentRegion.code
              return (
                <Pressable
                  key={region.code}
                  onPress={() => onSelect(region)}
                  style={({ pressed }) => [
                    styles.regionOption,
                    active && styles.regionOptionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.regionOptionFlag}>{region.flag}</Text>
                  <View style={styles.regionOptionInfo}>
                    <Text style={[styles.regionOptionName, active && styles.regionOptionNameActive]}>
                      {region.label}
                    </Text>
                    <Text style={styles.regionOptionCurrency}>
                      {region.currencyCode} · {region.language.toUpperCase()}
                    </Text>
                  </View>
                  {active && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                  )}
                </Pressable>
              )
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getProductId(product) {
  return product?.product_id ?? product?.id ?? product?.ProductID ?? product?.uuid
}

function getProductImage(product) {
  return String(product.Image ?? product.image_url ?? product.image ?? product.photo_url ?? '').trim()
}

function getProductName(product) {
  return product.product_name ?? product.name ?? product.title ?? 'Untitled product'
}

function getProductCategory(product) {
  const explicit = product.category || product.type
  if (explicit) return explicit
  const name = product.product_name ?? product.name ?? product.title
  if (!name) return 'Other'
  const n = name.toLowerCase()
  if (/dress|skirt|gown|maxi|midi|mini/.test(n)) return 'Dresses'
  if (/jacket|coat|blazer|hoodie|sweater|cardigan|pullover/.test(n)) return 'Outerwear'
  if (/jeans|pants|trousers|shorts|legging/.test(n)) return 'Bottoms'
  if (/shirt|blouse|tee|t-shirt|tank|crop|top/.test(n)) return 'Tops'
  if (/shoe|boot|sneaker|heel|sandal|loafer|flat/.test(n)) return 'Shoes'
  if (/bag|purse|wallet|clutch|backpack|tote/.test(n)) return 'Bags'
  if (/watch|bracelet|necklace|ring|earring|jewelry|scarf|hat|cap|belt|sunglasses/.test(n)) return 'Accessories'
  if (/suit|tuxedo|formal/.test(n)) return 'Formal'
  if (/swim|bikini/.test(n)) return 'Swimwear'
  return 'Other'
}

// ─── themes ─────────────────────────────────────────────────────────────────

const lightTheme = {
  screen: '#fbfaf8',
  text: '#111',
  muted: '#716b64',
  subtle: '#8a8178',
  border: '#e8e2d9',
  card: '#fff',
  avatar: '#1d1a18',
  avatarText: '#ded8cf',
  danger: '#b42318',
  success: '#2c5c4a',
  placeholder: '#eee7dc',
  primary: '#6849a7',
  primaryBg: '#f0ecf8',
}

const darkTheme = {
  screen: '#151515',
  text: '#f5f1ea',
  muted: '#c8bfb3',
  subtle: '#9b9187',
  border: '#3a342e',
  card: '#211f1d',
  avatar: '#070707',
  avatarText: '#c8bfb3',
  danger: '#ff9a8f',
  success: '#8fd0ad',
  placeholder: '#302b26',
  primary: '#a98ddf',
  primaryBg: '#2a2438',
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { backgroundColor: theme.screen, flex: 1 },
    content: { paddingBottom: 40 },
    header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
    kicker: { color: theme.subtle, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    title: { color: theme.text, fontSize: 30, fontWeight: '900' },
    avatarSection: { alignItems: 'center', paddingVertical: 28 },
    avatar: {
      alignItems: 'center',
      backgroundColor: theme.avatar,
      borderRadius: 48,
      height: 96,
      justifyContent: 'center',
      width: 96,
    },
    avatarText: { color: theme.avatarText, fontSize: 32, fontWeight: '900' },
    email: { color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 14 },

    // Settings card
    card: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 12,
      borderWidth: 1,
      marginHorizontal: 20,
      paddingHorizontal: 16,
    },
    row: {
      alignItems: 'center',
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 58,
    },
    lastRow: { borderBottomWidth: 0 },
    rowLabel: { color: theme.muted, fontSize: 15, fontWeight: '600' },
    rowValue: { color: theme.text, fontSize: 15, fontWeight: '700' },
    chipButton: {
      alignItems: 'center',
      backgroundColor: theme.text,
      borderRadius: 8,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: 14,
    },
    chipButtonText: { color: theme.screen, fontSize: 13, fontWeight: '900' },
    regionRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    regionFlag: { fontSize: 20 },
    regionInfo: { alignItems: 'flex-end' },
    regionName: { color: theme.text, fontSize: 14, fontWeight: '800' },
    regionCurrency: { color: theme.subtle, fontSize: 12 },

    // Actions card
    actionsCard: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 12,
      borderWidth: 1,
      marginHorizontal: 20,
      marginTop: 12,
      paddingHorizontal: 16,
    },
    actionRow: {
      alignItems: 'center',
      flexDirection: 'row',
      minHeight: 54,
    },
    actionIcon: {
      alignItems: 'center',
      backgroundColor: theme.primaryBg,
      borderRadius: 8,
      height: 34,
      justifyContent: 'center',
      marginRight: 12,
      width: 34,
    },
    actionLabel: { color: theme.text, flex: 1, fontSize: 15, fontWeight: '700' },
    actionChevron: { marginLeft: 'auto' },

    // Section headers
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 28,
      marginBottom: 12,
      paddingHorizontal: 20,
    },
    sectionTitle: { color: theme.text, fontSize: 20, fontWeight: '900' },
    sectionMeta: { color: theme.subtle, fontSize: 13, fontWeight: '700' },

    // Empty state cards
    emptyCard: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 10,
      borderWidth: 1,
      marginHorizontal: 20,
      padding: 18,
    },
    emptyTitle: { color: theme.text, fontSize: 15, fontWeight: '900', textAlign: 'center' },
    emptyText: { color: theme.muted, fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: 'center' },

    // Recent/wishlist list
    recentList: { gap: 10, paddingHorizontal: 20 },
    recentCard: {
      alignItems: 'center',
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      padding: 10,
    },
    recentImageWrap: {
      alignItems: 'center',
      backgroundColor: theme.placeholder,
      borderRadius: 8,
      height: 80,
      justifyContent: 'center',
      overflow: 'hidden',
      width: 62,
    },
    recentImage: { height: '100%', width: '100%' },
    placeholderText: { color: theme.subtle, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    recentBody: { flex: 1 },
    recentCategory: { color: theme.subtle, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    recentName: { color: theme.text, fontSize: 14, fontWeight: '900', lineHeight: 18, marginTop: 3 },
    recentStock: { color: theme.primary, fontSize: 11, fontWeight: '900', marginTop: 4 },
    recentStockOut: { color: theme.danger },
    recentPrice: { color: theme.success, fontSize: 13, fontWeight: '900', marginTop: 4 },
    removeButton: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
    },
    wishlistCartBtn: {
      alignItems: 'center',
      borderColor: theme.primary,
      borderRadius: 5,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    wishlistCartBtnActive: {
      backgroundColor: theme.primary,
    },
    wishlistCartBtnText: {
      color: theme.primary,
      fontSize: 10,
      fontWeight: '800',
    },
    wishlistCartBtnTextActive: {
      color: '#fff',
    },

    // Region modal
    modalBackdrop: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      flex: 1,
      justifyContent: 'flex-end',
    },
    regionModal: {
      backgroundColor: theme.screen,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '75%',
      paddingBottom: 32,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    regionModalHandle: {
      alignSelf: 'center',
      backgroundColor: theme.border,
      borderRadius: 3,
      height: 4,
      marginBottom: 16,
      width: 40,
    },
    regionModalTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 16,
      textAlign: 'center',
    },
    regionOption: {
      alignItems: 'center',
      borderRadius: 10,
      flexDirection: 'row',
      gap: 14,
      marginBottom: 6,
      padding: 14,
    },
    regionOptionActive: { backgroundColor: theme.primaryBg },
    regionOptionFlag: { fontSize: 24 },
    regionOptionInfo: { flex: 1 },
    regionOptionName: { color: theme.text, fontSize: 15, fontWeight: '800' },
    regionOptionNameActive: { color: theme.primary },
    regionOptionCurrency: { color: theme.subtle, fontSize: 12, marginTop: 2 },

    // Footer
    footer: { padding: 20 },
    signOutButton: {
      alignItems: 'center',
      backgroundColor: theme.text,
      borderRadius: 10,
      justifyContent: 'center',
      minHeight: 54,
    },
    signOutText: { color: theme.screen, fontSize: 16, fontWeight: '800' },
    pressed: { opacity: 0.82 },
    disabled: { opacity: 0.6 },
  })
}
