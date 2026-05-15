import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { formatLocalizedPrice, useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 10

const STATUS_COLORS = {
  pending:   { bg: '#fef3c7', text: '#92400e' },
  confirmed: { bg: '#dbeafe', text: '#1e40af' },
  shipped:   { bg: '#ede9fe', text: '#5b21b6' },
  delivered: { bg: '#d1fae5', text: '#065f46' },
}

const STATUS_COLORS_DARK = {
  pending:   { bg: '#3d2e07', text: '#fcd34d' },
  confirmed: { bg: '#1e3a5f', text: '#93c5fd' },
  shipped:   { bg: '#2e1a5e', text: '#c4b5fd' },
  delivered: { bg: '#064e3b', text: '#6ee7b7' },
}

export default function OrderHistoryScreen() {
  const colorScheme = useColorScheme()
  const i18n = useI18n()
  const { t } = i18n
  const isDark = colorScheme === 'dark'
  const theme = isDark ? darkTheme : lightTheme
  const styles = useMemo(() => createStyles(theme), [theme])
  const statusColors = isDark ? STATUS_COLORS_DARK : STATUS_COLORS

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const loadOrders = useCallback(async (nextPage = 0) => {
    if (nextPage === 0) setLoading(true)
    else setLoadingMore(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      setLoading(false)
      setLoadingMore(false)
      setError('Not signed in.')
      return
    }

    const from = nextPage * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    setLoading(false)
    setLoadingMore(false)

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    const fetched = data ?? []
    setOrders((prev) => (nextPage === 0 ? fetched : [...prev, ...fetched]))
    setHasMore(fetched.length === PAGE_SIZE)
    setPage(nextPage)
    setError('')
  }, [])

  useEffect(() => {
    loadOrders(0)
  }, [loadOrders])

  function statusLabel(status) {
    const map = {
      pending: t('statusPending'),
      confirmed: t('statusConfirmed'),
      shipped: t('statusShipped'),
      delivered: t('statusDelivered'),
    }
    return map[status] ?? status ?? t('statusPending')
  }

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>{t('yourAccount')}</Text>
          <Text style={styles.title}>{t('orderHistory')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={36} color={theme.subtle} />
          <Text style={styles.errorTitle}>{error}</Text>
          <Pressable onPress={() => loadOrders(0)} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('tryAgain')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={theme.subtle} />
              <Text style={styles.emptyTitle}>{t('noOrders')}</Text>
              <Text style={styles.emptyText}>{t('noOrdersHelp')}</Text>
              <Pressable onPress={() => router.back()} style={styles.shopButton}>
                <Text style={styles.shopButtonText}>{t('home')}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const expanded = expandedId === item.id
            const sc = statusColors[item.status] ?? statusColors.pending
            const orderItems = Array.isArray(item.items) ? item.items : item.items?.products ?? []
            const payment = Array.isArray(item.items) ? null : item.items?.payment

            return (
              <Pressable
                onPress={() => toggleExpand(item.id)}
                style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}
              >
                <View style={styles.orderTop}>
                  <View style={styles.orderTopLeft}>
                    <Text style={styles.orderId}>#{String(item.id).slice(0, 8).toUpperCase()}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(item.created_at).toLocaleDateString(i18n.localeTag, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.orderTopRight}>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.text }]}>
                        {statusLabel(item.status)}
                      </Text>
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={theme.subtle}
                    />
                  </View>
                </View>

                <View style={styles.orderMeta}>
                  <Text style={styles.orderTotal}>
                    {formatLocalizedPrice(item.total, i18n)}
                  </Text>
                  <Text style={styles.orderItemCount}>
                    {orderItems.length} {t('items')}
                  </Text>
                </View>

                {expanded && orderItems.length > 0 && (
                  <View style={styles.orderItems}>
                    <View style={styles.divider} />
                    {payment ? (
                      <View style={styles.paymentRow}>
                        <Ionicons
                          name={payment.method === 'cash' ? 'cash-outline' : 'card-outline'}
                          size={14}
                          color={theme.muted}
                        />
                        <Text style={styles.paymentSummary}>
                          {payment.method === 'cash'
                            ? 'Cash on Delivery'
                            : `${payment.brand} ••••${payment.last4}`}
                        </Text>
                      </View>
                    ) : null}
                    {orderItems.map((oi, idx) => (
                      <View key={idx} style={styles.orderItem}>
                        {oi.image ? (
                          <Image source={{ uri: oi.image }} style={styles.orderItemImage} />
                        ) : (
                          <View style={[styles.orderItemImage, styles.orderItemPlaceholder]}>
                            <Text style={styles.placeholderText}>A</Text>
                          </View>
                        )}
                        <View style={styles.orderItemBody}>
                          <Text style={styles.orderItemName} numberOfLines={2}>
                            {oi.name ?? 'Product'}
                          </Text>
                          <Text style={styles.orderItemMeta}>
                            {t('qty')}: {oi.quantity} × {formatLocalizedPrice(oi.price, i18n)}
                          </Text>
                        </View>
                        <Text style={styles.orderItemTotal}>
                          {formatLocalizedPrice((oi.price ?? 0) * (oi.quantity ?? 1), i18n)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Pressable>
            )
          }}
          ListFooterComponent={
            hasMore ? (
              <Pressable
                onPress={() => loadOrders(page + 1)}
                disabled={loadingMore}
                style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressed]}
              >
                {loadingMore ? (
                  <ActivityIndicator color={theme.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>{t('loadMore')}</Text>
                )}
              </Pressable>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

// ─── themes ─────────────────────────────────────────────────────────────────

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
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    backButton: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    kicker: {
      color: theme.subtle,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    title: { color: theme.text, fontSize: 24, fontWeight: '900' },
    center: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 32,
    },
    errorTitle: {
      color: theme.muted,
      fontSize: 15,
      marginTop: 12,
      textAlign: 'center',
    },
    retryButton: {
      alignItems: 'center',
      backgroundColor: theme.text,
      borderRadius: 8,
      marginTop: 16,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    retryText: { color: theme.screen, fontSize: 14, fontWeight: '800' },
    list: { gap: 12, padding: 16, paddingBottom: 32 },
    orderCard: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
    },
    pressed: { opacity: 0.88 },
    orderTop: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    orderTopLeft: { gap: 2 },
    orderId: { color: theme.text, fontSize: 13, fontWeight: '900' },
    orderDate: { color: theme.muted, fontSize: 12 },
    orderTopRight: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    statusBadge: {
      borderRadius: 6,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    statusText: { fontSize: 12, fontWeight: '800' },
    orderMeta: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    orderTotal: { color: theme.text, fontSize: 18, fontWeight: '900' },
    orderItemCount: { color: theme.subtle, fontSize: 13, fontWeight: '700' },
    orderItems: { marginTop: 8 },
    paymentRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      marginBottom: 12,
    },
    paymentSummary: {
      color: theme.muted,
      fontSize: 12,
      fontWeight: '800',
    },
    divider: {
      backgroundColor: theme.border,
      height: StyleSheet.hairlineWidth,
      marginBottom: 12,
    },
    orderItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    orderItemImage: {
      borderRadius: 6,
      height: 52,
      width: 44,
    },
    orderItemPlaceholder: {
      alignItems: 'center',
      backgroundColor: theme.placeholder,
      justifyContent: 'center',
    },
    placeholderText: { color: theme.subtle, fontSize: 12, fontWeight: '900' },
    orderItemBody: { flex: 1 },
    orderItemName: { color: theme.text, fontSize: 13, fontWeight: '800', lineHeight: 17 },
    orderItemMeta: { color: theme.muted, fontSize: 12, marginTop: 3 },
    orderItemTotal: { color: theme.success, fontSize: 13, fontWeight: '900' },
    emptyState: {
      alignItems: 'center',
      paddingTop: 60,
      paddingHorizontal: 32,
    },
    emptyTitle: { color: theme.text, fontSize: 20, fontWeight: '900', marginTop: 16, textAlign: 'center' },
    emptyText: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
    shopButton: {
      alignItems: 'center',
      backgroundColor: theme.text,
      borderRadius: 8,
      marginTop: 24,
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    shopButtonText: { color: theme.screen, fontSize: 15, fontWeight: '900' },
    loadMoreButton: {
      alignItems: 'center',
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: 'center',
      marginTop: 4,
      minHeight: 44,
    },
    loadMoreText: { color: theme.primary, fontSize: 14, fontWeight: '800' },
  })
}
