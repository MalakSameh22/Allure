import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { formatLocalizedPrice, useI18n } from '../lib/i18n'
import { useCart, getCartItemId } from '../lib/cart'
import { supabase } from '../lib/supabase'
import { hapticAddToCart, hapticCheckoutSuccess, hapticSwipeAction } from '../lib/haptics'
import { getProductStockStatus, useRealtimeStock } from '../hooks/useRealtimeStock'
import {
  getSavedCards,
  saveCard as persistCard,
  deleteCard as removeCard,
} from '../lib/paymentMethods'

export default function CartScreen() {
  const colorScheme = useColorScheme()
  const i18n = useI18n()
  const { t } = i18n
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme
  const styles = useMemo(() => createStyles(theme), [theme])

  const { items, removeItem, updateQuantity, clearCart, totalItems } = useCart()
  const cartProducts = useMemo(() => items.map((item) => item.product), [items])
  const liveProducts = useRealtimeStock(cartProducts)
  const liveItems = useMemo(
    () =>
      items.map((item) => {
        const productId = getCartItemId(item.product)
        const live = liveProducts.find((p) => getCartItemId(p) === productId)
        return live ? { ...item, product: { ...item.product, ...live } } : item
      }),
    [items, liveProducts]
  )
  const liveTotalPrice = useMemo(
    () =>
      liveItems.reduce((sum, item) => {
        const price = Number(item.product.price ?? item.product.sale_price ?? item.product.amount ?? 0)
        return sum + price * item.quantity
      }, 0),
    [liveItems]
  )

  // checkout orchestration
  const [checkoutVisible, setCheckoutVisible] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState('method') // 'method' | 'card'
  const [selectedMethod, setSelectedMethod] = useState(null)  // 'cod' | 'new_card' | 'saved_card'
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [savedCards, setSavedCards] = useState([])
  const [saveNewCard, setSaveNewCard] = useState(false)
  const [placing, setPlacing] = useState(false)

  // card form fields
  const [cardholderName, setCardholderName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [securityCode, setSecurityCode] = useState('')

  const cardBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber])
  const selectedCard = savedCards.find((c) => c.id === selectedCardId) ?? null

  useEffect(() => {
    if (checkoutVisible) {
      getSavedCards().then(setSavedCards)
      setCheckoutStep('method')
      setSelectedMethod(null)
      setSelectedCardId(null)
      setSecurityCode('')
    }
  }, [checkoutVisible])

  function openCheckout() {
    if (items.length === 0) return
    setCheckoutVisible(true)
  }

  function closeCheckout() {
    if (placing) return
    setCheckoutVisible(false)
    clearForm()
  }

  function clearForm() {
    setCardholderName('')
    setCardNumber('')
    setExpiry('')
    setSecurityCode('')
    setSaveNewCard(false)
    setSelectedMethod(null)
    setSelectedCardId(null)
    setCheckoutStep('method')
  }

  function handleMethodContinue() {
    if (!selectedMethod) return
    if (selectedMethod === 'cod') {
      submitCheckout()
    } else {
      setCheckoutStep('card')
    }
  }

  async function handleDeleteCard(id) {
    await removeCard(id)
    setSavedCards((prev) => prev.filter((c) => c.id !== id))
    if (selectedCardId === id) {
      setSelectedMethod(null)
      setSelectedCardId(null)
    }
  }

  async function submitCheckout() {
    if (liveItems.length === 0 || placing) return

    let payment
    if (selectedMethod === 'cod') {
      payment = getCodPaymentSummary()
    } else if (selectedMethod === 'saved_card') {
      if (!selectedCard) { Alert.alert('Error', 'Saved card not found.'); return }
      payment = getSavedCardPaymentSummary(selectedCard, securityCode)
    } else {
      payment = getNewCardPaymentSummary({ cardholderName, cardNumber, expiry, securityCode })
    }

    if (!payment.valid) {
      Alert.alert('Check payment details', payment.error)
      return
    }

    setPlacing(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      setPlacing(false)
      Alert.alert(t('orderError'), 'Not signed in.')
      return
    }

    if (selectedMethod === 'new_card' && saveNewCard) {
      const digits = onlyDigits(cardNumber)
      await persistCard({
        brand: detectCardBrand(digits),
        last4: digits.slice(-4),
        expiry: formatExpiry(expiry),
        cardholder: cardholderName.trim(),
      }).catch(() => {})
    }

    const orderItems = liveItems.map(({ product, quantity }) => ({
      product_id: getCartItemId(product),
      name: product.product_name ?? product.name ?? 'Product',
      price: Number(product.price ?? product.sale_price ?? product.amount ?? 0),
      quantity,
      image: product.Image ?? product.image_url ?? product.image ?? null,
    }))

    const orderPayload = {
      user_id: userData.user.id,
      status: 'pending',
      total: liveTotalPrice,
      items: { products: orderItems, payment: payment.summary },
    }

    const { error } = await supabase.from('orders').insert(orderPayload)
    setPlacing(false)

    if (error) {
      Alert.alert(t('orderError'), error.message)
      return
    }

    hapticCheckoutSuccess()
    setCheckoutVisible(false)
    clearForm()
    clearCart()

    const receiptUri = await createAndShareReceipt({
      i18n,
      items: orderItems,
      order: orderPayload,
      payment: payment.summary,
      total: liveTotalPrice,
      userEmail: userData.user.email,
    })

    Alert.alert(
      t('orderPlaced'),
      receiptUri
        ? `${t('orderPlacedHelp')}\nReceipt saved and ready to share.`
        : t('orderPlacedHelp'),
      [{ text: 'OK', onPress: () => router.replace('/orders') }]
    )
  }

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>{t('checkout')}</Text>
          <Text style={styles.title}>{t('shoppingCart')}</Text>
        </View>
        {totalItems > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{totalItems}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={liveItems}
        keyExtractor={(item) => String(getCartItemId(item.product))}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="bag-outline" size={48} color={theme.subtle} />
            <Text style={styles.emptyTitle}>{t('cartEmpty')}</Text>
            <Text style={styles.emptyText}>{t('cartEmptyHelp')}</Text>
            <Pressable onPress={() => router.back()} style={styles.shopButton}>
              <Text style={styles.shopButtonText}>{t('home')}</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <CartItem
            item={item}
            i18n={i18n}
            styles={styles}
            theme={theme}
            onRemove={() => {
              hapticSwipeAction()
              removeItem(getCartItemId(item.product))
              Alert.alert('Removed', `${getProductName(item.product)} removed from cart.`)
            }}
            onDecrease={() => {
              hapticSwipeAction()
              updateQuantity(getCartItemId(item.product), item.quantity - 1)
              Alert.alert('Cart updated', `${getProductName(item.product)} quantity updated.`)
            }}
            onIncrease={() => {
              hapticAddToCart()
              updateQuantity(getCartItemId(item.product), item.quantity + 1)
              Alert.alert(t('addToCart'), `${getProductName(item.product)} added to cart.`)
            }}
          />
        )}
        ListFooterComponent={
          items.length > 0 ? (
            <View style={styles.footer}>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>{t('subtotal')}</Text>
                <Text style={styles.subtotalValue}>{formatLocalizedPrice(liveTotalPrice, i18n)}</Text>
              </View>
              <Pressable
                onPress={openCheckout}
                disabled={placing}
                style={({ pressed }) => [styles.placeOrderButton, pressed && styles.pressed, placing && styles.disabled]}
              >
                {placing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.placeOrderText}>{t('placeOrder')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null
        }
      />

      {/* ── Checkout modal ── */}
      <Modal animationType="slide" transparent visible={checkoutVisible} onRequestClose={closeCheckout}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.checkoutPanel}>

            {/* ── Step 1: choose payment method ── */}
            {checkoutStep === 'method' && (
              <>
                <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.checkoutTitle}>Payment method</Text>
                  <Text style={styles.checkoutCopy}>Choose how you'd like to pay.</Text>

                  {savedCards.length > 0 && (
                    <Text style={styles.sectionLabel}>Saved cards</Text>
                  )}
                  {savedCards.map((card) => {
                    const active = selectedMethod === 'saved_card' && selectedCardId === card.id
                    return (
                      <Pressable
                        key={card.id}
                        onPress={() => { setSelectedMethod('saved_card'); setSelectedCardId(card.id) }}
                        style={styles.methodRow}
                      >
                        <View style={[styles.methodRadio, active && styles.methodRadioActive]}>
                          {active && <View style={styles.methodRadioDot} />}
                        </View>
                        <Ionicons name="card" size={20} color={theme.primary} style={styles.methodIcon} />
                        <View style={styles.methodInfo}>
                          <Text style={styles.methodTitle}>{card.brand} ••••{card.last4}</Text>
                          <Text style={styles.methodSub}>Expires {card.expiry} · {card.cardholder}</Text>
                        </View>
                        <Pressable onPress={() => handleDeleteCard(card.id)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={15} color={theme.danger} />
                        </Pressable>
                      </Pressable>
                    )
                  })}

                  <Pressable
                    onPress={() => { setSelectedMethod('new_card'); setSelectedCardId(null) }}
                    style={styles.methodRow}
                  >
                    <View style={[styles.methodRadio, selectedMethod === 'new_card' && styles.methodRadioActive]}>
                      {selectedMethod === 'new_card' && <View style={styles.methodRadioDot} />}
                    </View>
                    <Ionicons name="card-outline" size={20} color={theme.primary} style={styles.methodIcon} />
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodTitle}>Add a new card</Text>
                      <Text style={styles.methodSub}>Credit or debit card</Text>
                    </View>
                  </Pressable>

                  <View style={styles.methodDivider} />

                  <Pressable
                    onPress={() => { setSelectedMethod('cod'); setSelectedCardId(null) }}
                    style={styles.methodRow}
                  >
                    <View style={[styles.methodRadio, selectedMethod === 'cod' && styles.methodRadioActive]}>
                      {selectedMethod === 'cod' && <View style={styles.methodRadioDot} />}
                    </View>
                    <Ionicons name="cash-outline" size={20} color={theme.success} style={styles.methodIcon} />
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodTitle}>Cash on Delivery</Text>
                      <Text style={styles.methodSub}>Pay when your order arrives</Text>
                    </View>
                  </Pressable>
                </ScrollView>

                <View style={styles.panelFooter}>
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>{t('subtotal')}</Text>
                    <Text style={styles.subtotalValue}>{formatLocalizedPrice(liveTotalPrice, i18n)}</Text>
                  </View>
                  <Pressable
                    disabled={!selectedMethod || placing}
                    onPress={handleMethodContinue}
                    style={({ pressed }) => [
                      styles.placeOrderButton,
                      pressed && styles.pressed,
                      (!selectedMethod || placing) && styles.disabled,
                    ]}
                  >
                    {placing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.placeOrderText}>
                        {selectedMethod === 'cod' ? 'Place order' : 'Continue'}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable disabled={placing} onPress={closeCheckout} style={styles.cancelButton}>
                    <Text style={styles.cancelButtonText}>{t('close')}</Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* ── Step 2: card details ── */}
            {checkoutStep === 'card' && (
              <>
                <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
                  <Pressable onPress={() => setCheckoutStep('method')} style={styles.backRow}>
                    <Ionicons name="arrow-back" size={14} color={theme.primary} />
                    <Text style={styles.backRowText}>Change payment method</Text>
                  </Pressable>

                  <Text style={styles.checkoutTitle}>
                    {selectedMethod === 'saved_card' ? 'Confirm payment' : 'Card details'}
                  </Text>

                  {/* Saved card info */}
                  {selectedMethod === 'saved_card' && selectedCard && (
                    <View style={styles.savedCardBox}>
                      <Ionicons name="card" size={28} color={theme.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.savedCardTitle}>{selectedCard.brand} ••••{selectedCard.last4}</Text>
                        <Text style={styles.savedCardSub}>Expires {selectedCard.expiry} · {selectedCard.cardholder}</Text>
                      </View>
                    </View>
                  )}

                  {/* New card form */}
                  {selectedMethod === 'new_card' && (
                    <>
                      <TextInput
                        autoCapitalize="words"
                        placeholder="Cardholder name"
                        placeholderTextColor={theme.subtle}
                        style={styles.input}
                        value={cardholderName}
                        onChangeText={setCardholderName}
                      />
                      <View style={styles.cardNumberWrap}>
                        <TextInput
                          keyboardType="number-pad"
                          maxLength={23}
                          placeholder="Card number"
                          placeholderTextColor={theme.subtle}
                          style={[styles.input, styles.cardNumberInput]}
                          textContentType="creditCardNumber"
                          value={formatCardNumber(cardNumber)}
                          onChangeText={setCardNumber}
                        />
                        {cardBrand !== 'Card' && (
                          <View style={styles.cardBrandBadge}>
                            <Text style={styles.cardBrandText}>{cardBrand}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.checkoutRow}>
                        <TextInput
                          keyboardType="number-pad"
                          maxLength={5}
                          placeholder="MM/YY"
                          placeholderTextColor={theme.subtle}
                          style={[styles.input, styles.halfInput]}
                          value={formatExpiry(expiry)}
                          onChangeText={setExpiry}
                        />
                        <TextInput
                          keyboardType="number-pad"
                          maxLength={4}
                          placeholder="CVV"
                          placeholderTextColor={theme.subtle}
                          secureTextEntry
                          style={[styles.input, styles.halfInput]}
                          value={securityCode}
                          onChangeText={setSecurityCode}
                        />
                      </View>
                      <View style={styles.saveCardRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.saveCardLabel}>Save this card</Text>
                          <Text style={styles.saveCardSub}>Stored encrypted on this device</Text>
                        </View>
                        <Switch
                          value={saveNewCard}
                          onValueChange={setSaveNewCard}
                          trackColor={{ false: theme.border, true: theme.primary }}
                          thumbColor="#fff"
                        />
                      </View>
                    </>
                  )}

                  {/* CVV-only for saved card */}
                  {selectedMethod === 'saved_card' && (
                    <TextInput
                      keyboardType="number-pad"
                      maxLength={4}
                      placeholder="CVV / security code"
                      placeholderTextColor={theme.subtle}
                      secureTextEntry
                      style={styles.input}
                      value={securityCode}
                      onChangeText={setSecurityCode}
                    />
                  )}

                  <View style={styles.secureNote}>
                    <Ionicons name="lock-closed-outline" size={13} color={theme.subtle} />
                    <Text style={styles.secureNoteText}>Your card number is never stored</Text>
                  </View>
                </ScrollView>

                <View style={styles.panelFooter}>
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>{t('subtotal')}</Text>
                    <Text style={styles.subtotalValue}>{formatLocalizedPrice(liveTotalPrice, i18n)}</Text>
                  </View>
                  <Pressable
                    disabled={placing}
                    onPress={submitCheckout}
                    style={({ pressed }) => [styles.placeOrderButton, pressed && styles.pressed, placing && styles.disabled]}
                  >
                    {placing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="lock-closed" size={15} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.placeOrderText}>Pay securely</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable disabled={placing} onPress={closeCheckout} style={styles.cancelButton}>
                    <Text style={styles.cancelButtonText}>{t('close')}</Text>
                  </Pressable>
                </View>
              </>
            )}

          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

// ─── CartItem component ───────────────────────────────────────────────────────

function CartItem({ item, i18n, styles, theme, onRemove, onDecrease, onIncrease }) {
  const { product, quantity } = item
  const imageUrl = String(product.Image ?? product.image_url ?? product.image ?? '').trim()
  const name = product.product_name ?? product.name ?? product.title ?? 'Product'
  const category = product.category ?? product.type ?? ''
  const price = Number(product.price ?? product.sale_price ?? product.amount ?? 0)
  const stockStatus = getProductStockStatus(product)

  return (
    <View style={styles.cartItem}>
      <View style={styles.itemImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.itemImage} />
        ) : (
          <Text style={styles.itemPlaceholder}>Allure</Text>
        )}
      </View>
      <View style={styles.itemBody}>
        {category ? <Text style={styles.itemCategory} numberOfLines={1}>{category}</Text> : null}
        <Text style={styles.itemName} numberOfLines={2}>{name}</Text>
        {stockStatus ? (
          <Text style={[styles.itemStock, stockStatus.isOut && styles.itemStockOut]}>{stockStatus.label}</Text>
        ) : null}
        <Text style={styles.itemPrice}>{i18n.t('qty')}: {quantity} × {formatLocalizedPrice(price, i18n)}</Text>
        <Text style={styles.itemTotal}>{formatLocalizedPrice(price * quantity, i18n)}</Text>
      </View>
      <View style={styles.itemActions}>
        <Pressable onPress={onIncrease} style={styles.qtyBtn} hitSlop={6}>
          <Ionicons name="add" size={16} color={theme.text} />
        </Pressable>
        <Text style={styles.qtyText}>{quantity}</Text>
        <Pressable onPress={onDecrease} style={styles.qtyBtn} hitSlop={6}>
          <Ionicons name="remove" size={16} color={theme.text} />
        </Pressable>
        <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={6}>
          <Ionicons name="trash-outline" size={14} color={theme.danger} />
        </Pressable>
      </View>
    </View>
  )
}

// ─── Payment helpers ──────────────────────────────────────────────────────────

function getProductName(product) {
  return product.product_name ?? product.name ?? product.title ?? 'Product'
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function formatCardNumber(value) {
  return onlyDigits(value).slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value) {
  const digits = onlyDigits(value).slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function detectCardBrand(cardNumber) {
  const d = onlyDigits(cardNumber)
  if (/^4/.test(d)) return 'Visa'
  if (/^5[1-5]/.test(d) || /^2(2[2-9]|[3-6]|7[01]|720)/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'Amex'
  if (/^6(?:011|5)/.test(d)) return 'Discover'
  return 'Card'
}

function passesLuhn(value) {
  const digits = onlyDigits(value)
  let sum = 0
  let shouldDouble = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i])
    if (shouldDouble) { digit *= 2; if (digit > 9) digit -= 9 }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return digits.length >= 12 && sum % 10 === 0
}

function isFutureExpiry(value) {
  const [monthRaw, yearRaw] = formatExpiry(value).split('/')
  const month = Number(monthRaw)
  const year = Number(yearRaw)
  if (!month || month < 1 || month > 12 || Number.isNaN(year)) return false
  return new Date(2000 + year, month, 0, 23, 59, 59) >= new Date()
}

function getNewCardPaymentSummary({ cardholderName, cardNumber, expiry, securityCode }) {
  const digits = onlyDigits(cardNumber)
  const cvv = onlyDigits(securityCode)
  if (!cardholderName.trim()) return { valid: false, error: 'Enter the cardholder name.' }
  if (!passesLuhn(digits)) return { valid: false, error: 'Enter a valid card number.' }
  if (!isFutureExpiry(expiry)) return { valid: false, error: 'Enter a valid future expiry date.' }
  if (cvv.length < 3 || cvv.length > 4) return { valid: false, error: 'Enter a valid CVV.' }
  return {
    valid: true,
    summary: {
      brand: detectCardBrand(digits),
      cardholder: cardholderName.trim(),
      expiry: formatExpiry(expiry),
      last4: digits.slice(-4),
      method: 'card',
      processed_at: new Date().toISOString(),
      status: 'authorized',
    },
  }
}

function getSavedCardPaymentSummary(card, securityCode) {
  const cvv = onlyDigits(securityCode)
  if (cvv.length < 3 || cvv.length > 4) return { valid: false, error: 'Enter the CVV for this card.' }
  return {
    valid: true,
    summary: {
      brand: card.brand,
      cardholder: card.cardholder,
      expiry: card.expiry,
      last4: card.last4,
      method: 'card',
      processed_at: new Date().toISOString(),
      status: 'authorized',
    },
  }
}

function getCodPaymentSummary() {
  return {
    valid: true,
    summary: {
      method: 'cash',
      status: 'pending_collection',
      processed_at: new Date().toISOString(),
    },
  }
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function buildReceiptHtml({ i18n, items, order, payment, total, userEmail }) {
  const rows = items.map((item) => {
    const lineTotal = Number(item.price ?? 0) * Number(item.quantity ?? 1)
    return `<tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${item.quantity}</td>
      <td>${formatLocalizedPrice(item.price, i18n)}</td>
      <td>${formatLocalizedPrice(lineTotal, i18n)}</td>
    </tr>`
  }).join('')

  const paymentLine =
    payment.method === 'cash'
      ? 'Cash on Delivery'
      : `${escapeHtml(payment.brand)} ending in ${escapeHtml(payment.last4)}`

  return `<!doctype html><html><head><meta charset="utf-8"/>
    <style>
      body{color:#111;font-family:Arial,sans-serif;padding:28px}
      h1{font-size:28px;margin:0 0 4px}
      .muted{color:#666;font-size:12px}
      .top{border-bottom:1px solid #ddd;margin-bottom:20px;padding-bottom:16px}
      table{border-collapse:collapse;margin-top:18px;width:100%}
      th,td{border-bottom:1px solid #eee;font-size:13px;padding:10px 8px;text-align:left}
      th{background:#f7f3ee;font-size:12px;text-transform:uppercase}
      .total{font-size:20px;font-weight:800;margin-top:22px;text-align:right}
      .box{background:#f7f3ee;border-radius:8px;margin-top:18px;padding:12px}
    </style></head><body>
    <div class="top">
      <h1>Allure Receipt</h1>
      <div class="muted">Order date: ${new Date(payment.processed_at).toLocaleString(i18n.localeTag)}</div>
      <div class="muted">Customer: ${escapeHtml(userEmail ?? 'Customer')}</div>
    </div>
    <div class="box">
      Payment: ${paymentLine}<br/>
      Status: ${escapeHtml(payment.status)}<br/>
      Order status: ${escapeHtml(order.status)}
    </div>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">Total: ${formatLocalizedPrice(total, i18n)}</div>
  </body></html>`
}

async function createAndShareReceipt({ i18n, items, order, payment, total, userEmail }) {
  try {
    const html = buildReceiptHtml({ i18n, items, order, payment, total, userEmail })
    const { uri } = await Print.printToFileAsync({ html })
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        dialogTitle: 'Share Allure receipt',
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      })
    }
    return uri
  } catch (err) {
    Alert.alert('Receipt export failed', err.message)
    return ''
  }
}

// ─── Themes ───────────────────────────────────────────────────────────────────

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
  countBg: '#f0ecf8',
  countText: '#6849a7',
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
  countBg: '#2a2438',
  countText: '#a98ddf',
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { backgroundColor: theme.screen, flex: 1 },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    backButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
    kicker: { color: theme.subtle, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    title: { color: theme.text, fontSize: 24, fontWeight: '900' },
    countBadge: {
      alignItems: 'center',
      backgroundColor: theme.countBg,
      borderRadius: 20,
      justifyContent: 'center',
      marginLeft: 'auto',
      minWidth: 32,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    countBadgeText: { color: theme.countText, fontSize: 13, fontWeight: '900' },
    list: { gap: 12, padding: 16, paddingBottom: 32 },
    cartItem: {
      alignItems: 'center',
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      padding: 12,
    },
    itemImageWrap: {
      alignItems: 'center',
      backgroundColor: theme.placeholder,
      borderRadius: 8,
      height: 90,
      justifyContent: 'center',
      overflow: 'hidden',
      width: 72,
    },
    itemImage: { height: '100%', width: '100%' },
    itemPlaceholder: { color: theme.subtle, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    itemBody: { flex: 1 },
    itemCategory: { color: theme.subtle, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    itemName: { color: theme.text, fontSize: 14, fontWeight: '800', lineHeight: 19, marginTop: 2 },
    itemStock: { color: theme.primary, fontSize: 11, fontWeight: '900', marginTop: 4 },
    itemStockOut: { color: theme.danger },
    itemPrice: { color: theme.muted, fontSize: 12, marginTop: 4 },
    itemTotal: { color: theme.success, fontSize: 14, fontWeight: '900', marginTop: 2 },
    itemActions: { alignItems: 'center', gap: 6 },
    qtyBtn: {
      alignItems: 'center',
      backgroundColor: theme.border,
      borderRadius: 6,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    qtyText: { color: theme.text, fontSize: 14, fontWeight: '900', minWidth: 20, textAlign: 'center' },
    removeBtn: {
      alignItems: 'center',
      borderColor: theme.danger,
      borderRadius: 6,
      borderWidth: 1,
      height: 28,
      justifyContent: 'center',
      marginTop: 4,
      width: 28,
    },
    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyTitle: { color: theme.text, fontSize: 20, fontWeight: '900', marginTop: 16, textAlign: 'center' },
    emptyText: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
    shopButton: {
      alignItems: 'center',
      backgroundColor: theme.text,
      borderRadius: 8,
      justifyContent: 'center',
      marginTop: 24,
      minHeight: 48,
      paddingHorizontal: 32,
    },
    shopButtonText: { color: theme.screen, fontSize: 15, fontWeight: '900' },
    footer: { borderTopColor: theme.border, borderTopWidth: 1, gap: 14, marginTop: 8, paddingTop: 16 },
    subtotalRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    subtotalLabel: { color: theme.muted, fontSize: 16, fontWeight: '700' },
    subtotalValue: { color: theme.text, fontSize: 20, fontWeight: '900' },
    placeOrderButton: {
      alignItems: 'center',
      backgroundColor: theme.primary,
      borderRadius: 10,
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: 54,
    },
    placeOrderText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    pressed: { opacity: 0.88 },
    disabled: { opacity: 0.55 },
    // modal
    modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.52)', flex: 1, justifyContent: 'flex-end' },
    checkoutPanel: {
      backgroundColor: theme.screen,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
    },
    panelScroll: { paddingHorizontal: 20, paddingTop: 20 },
    panelFooter: {
      borderTopColor: theme.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 12,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    },
    checkoutTitle: { color: theme.text, fontSize: 22, fontWeight: '900', marginBottom: 4 },
    checkoutCopy: { color: theme.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
    // method selection
    sectionLabel: {
      color: theme.subtle,
      fontSize: 11,
      fontWeight: '800',
      marginBottom: 6,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    methodRow: {
      alignItems: 'center',
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      marginBottom: 8,
      padding: 14,
    },
    methodRadio: {
      alignItems: 'center',
      borderColor: theme.border,
      borderRadius: 10,
      borderWidth: 2,
      height: 20,
      justifyContent: 'center',
      width: 20,
    },
    methodRadioActive: { borderColor: theme.primary },
    methodRadioDot: {
      backgroundColor: theme.primary,
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    methodIcon: { marginRight: -4 },
    methodInfo: { flex: 1 },
    methodTitle: { color: theme.text, fontSize: 14, fontWeight: '800' },
    methodSub: { color: theme.muted, fontSize: 12, marginTop: 2 },
    methodDivider: {
      backgroundColor: theme.border,
      height: StyleSheet.hairlineWidth,
      marginBottom: 10,
      marginTop: 4,
    },
    // card step
    backRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      marginBottom: 14,
    },
    backRowText: { color: theme.primary, fontSize: 13, fontWeight: '700' },
    savedCardBox: {
      alignItems: 'center',
      backgroundColor: theme.card,
      borderColor: theme.primary,
      borderRadius: 12,
      borderWidth: 1.5,
      flexDirection: 'row',
      gap: 14,
      marginBottom: 14,
      padding: 16,
    },
    savedCardTitle: { color: theme.text, fontSize: 16, fontWeight: '900' },
    savedCardSub: { color: theme.muted, fontSize: 12, marginTop: 3 },
    cardNumberWrap: { position: 'relative' },
    cardNumberInput: { paddingRight: 80 },
    cardBrandBadge: {
      alignItems: 'center',
      backgroundColor: theme.primary + '22',
      borderRadius: 6,
      bottom: 14,
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      position: 'absolute',
      right: 10,
      top: 14,
    },
    cardBrandText: { color: theme.primary, fontSize: 11, fontWeight: '900' },
    checkoutRow: { flexDirection: 'row', gap: 10 },
    input: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      color: theme.text,
      fontSize: 15,
      marginBottom: 10,
      minHeight: 52,
      paddingHorizontal: 14,
    },
    halfInput: { flex: 1 },
    saveCardRow: {
      alignItems: 'center',
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
      padding: 14,
    },
    saveCardLabel: { color: theme.text, fontSize: 14, fontWeight: '800' },
    saveCardSub: { color: theme.muted, fontSize: 12, marginTop: 2 },
    secureNote: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      marginBottom: 8,
      marginTop: 10,
    },
    secureNoteText: { color: theme.subtle, fontSize: 12 },
    cancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 42 },
    cancelButtonText: { color: theme.muted, fontSize: 14, fontWeight: '800' },
  })
}
