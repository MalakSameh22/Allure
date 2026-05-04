import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './lib/supabase'

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <SafeAreaProvider>
      {authLoading ? (
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.loadingScreen}>
          <StatusBar style="dark" />
          <ActivityIndicator color="#111" />
        </SafeAreaView>
      ) : session ? (
        <HomeScreen />
      ) : (
        <AuthScreen />
      )}
    </SafeAreaProvider>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === 'signUp'

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password to continue.')
      return
    }

    setLoading(true)
    const credentials = { email: email.trim(), password }
    const { error } = isSignUp
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials)

    setLoading(false)

    if (error) {
      Alert.alert('Authentication failed', error.message)
      return
    }

    if (isSignUp) {
      Alert.alert('Check your email', 'Confirm your account, then sign in.')
      setMode('signIn')
    }
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.authScreen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.authKeyboard}
      >
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <Text style={styles.logo}>Allure</Text>
            <Text style={styles.authTitle}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.authSubtitle}>
              Curated fashion drops, styled picks, and new-season essentials.
            </Text>
          </View>

          <View style={styles.modeControl}>
            <Pressable
              style={[styles.modeButton, !isSignUp && styles.modeButtonActive]}
              onPress={() => setMode('signIn')}
            >
              <Text style={[styles.modeText, !isSignUp && styles.modeTextActive]}>Sign in</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, isSignUp && styles.modeButtonActive]}
              onPress={() => setMode('signUp')}
            >
              <Text style={[styles.modeText, isSignUp && styles.modeTextActive]}>Sign up</Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#8f8f8f"
              style={styles.input}
              value={email}
            />
            <TextInput
              autoCapitalize="none"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#8f8f8f"
              secureTextEntry
              style={styles.input}
              value={password}
            />

            <Pressable
              disabled={loading}
              onPress={submit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function HomeScreen() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  const categories = useMemo(() => {
    const values = products
      .map((product) => getProductCategory(product))
      .filter(Boolean)
      .filter((value, index, array) => array.findIndex((item) => normalize(item) === normalize(value)) === index)

    return ['All', ...values]
  }, [products])

  const visibleProducts = useMemo(() => {
    if (selectedCategory === 'All') {
      return products
    }

    return products.filter((product) => normalize(getProductCategory(product)) === normalize(selectedCategory))
  }, [products, selectedCategory])

  async function loadProducts(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    const { data, error } = await supabase
      .from('Products')
      .select('product_id, product_name, price, Image, color, size')

    setLoading(false)
    setRefreshing(false)

    if (error) {
      setErrorMessage(error.message)
      setProducts([])
      return
    }

    setErrorMessage('')
    setProducts(data ?? [])
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.homeScreen}>
      <StatusBar style="dark" />
      <FlatList
        data={visibleProducts}
        keyExtractor={(item, index) => String(item.id ?? item.product_id ?? index)}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.homeContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadProducts(true)} tintColor="#111" />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View>
                <Text style={styles.homeKicker}>New season edit</Text>
                <Text style={styles.homeTitle}>Allure</Text>
              </View>
              <Pressable onPress={signOut} style={styles.signOutButton}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>

            <View style={styles.hero}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Fashion pieces selected for your next look</Text>
                <Text style={styles.heroText}>Shop elevated essentials and statement styles.</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            >
              {categories.map((category) => {
                const active = selectedCategory === category
                return (
                  <Pressable
                    key={category}
                    onPress={() => setSelectedCategory(category)}
                    style={[styles.categoryButton, active && styles.categoryButtonActive]}
                  >
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Products</Text>
              <Text style={styles.productCount}>{visibleProducts.length} items</Text>
            </View>

            {errorMessage ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageTitle}>Could not load products</Text>
                <Text style={styles.messageText}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#111" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.messageTitle}>No products yet</Text>
              <Text style={styles.messageText}>Add rows to your Supabase Products table to show them here.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <ProductCard product={item} />}
      />
    </SafeAreaView>
  )
}

function ProductCard({ product }) {
  const imageUrl = String(
    product.Image ?? product.image_url ?? product.image ?? product.photo_url ?? product.thumbnail_url ?? ''
  ).trim()
  const name = product.product_name ?? product.name ?? product.title ?? 'Untitled product'
  const category = getProductCategory(product)
  const description = product.description ?? product.details ?? product.subtitle
  const price = product.price ?? product.sale_price ?? product.amount
  const size = product.size
  const color = String(product.color ?? '').trim()

  return (
    <Pressable style={({ pressed }) => [styles.productCard, pressed && styles.cardPressed]}>
      <View style={styles.productImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productImage} />
        ) : (
          <View style={styles.productPlaceholder}>
            <Text style={styles.productPlaceholderText}>Allure</Text>
          </View>
        )}
        <View style={styles.productBadge}>
          <Text style={styles.productBadgeText}>New</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={styles.productCategory}>
        {category}
      </Text>
      <Text numberOfLines={2} style={styles.productName}>
        {name}
      </Text>
      {description || size || color ? (
        <Text numberOfLines={2} style={styles.productDescription}>
          {description ?? [color, size ? `Size ${size}` : ''].filter(Boolean).join(' - ')}
        </Text>
      ) : null}
      <Text style={styles.productPrice}>{formatPrice(price)}</Text>
    </Pressable>
  )
}

function getProductCategory(product) {
  return product.category ?? product.type ?? product.product_name ?? 'Fashion'
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') {
    return 'Price on request'
  }

  const numberValue = Number(value)

  if (Number.isNaN(numberValue)) {
    return String(value)
  }

  return `$${numberValue.toFixed(2)}`
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

const styles = StyleSheet.create({
  authScreen: {
    flex: 1,
    backgroundColor: '#f7f5f1',
  },
  authKeyboard: {
    flex: 1,
  },
  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brandBlock: {
    marginBottom: 28,
  },
  logo: {
    color: '#111',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 28,
    textTransform: 'uppercase',
  },
  authTitle: {
    color: '#111',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 42,
    maxWidth: 320,
  },
  authSubtitle: {
    color: '#65615c',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 330,
  },
  modeControl: {
    backgroundColor: '#e8e2d9',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#fff',
  },
  modeText: {
    color: '#6d675f',
    fontSize: 14,
    fontWeight: '700',
  },
  modeTextActive: {
    color: '#111',
  },
  form: {
    gap: 12,
    marginTop: 18,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e1ddd6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111',
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 54,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#f7f5f1',
    flex: 1,
    justifyContent: 'center',
  },
  homeScreen: {
    backgroundColor: '#fbfaf8',
    flex: 1,
  },
  homeContent: {
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  homeKicker: {
    color: '#8a8178',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  homeTitle: {
    color: '#111',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
  },
  signOutButton: {
    borderColor: '#ded8cf',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  signOutText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '800',
  },
  hero: {
    backgroundColor: '#1d1a18',
    borderRadius: 8,
    minHeight: 158,
    justifyContent: 'flex-end',
    marginBottom: 18,
    overflow: 'hidden',
    padding: 18,
  },
  heroCopy: {
    maxWidth: 310,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 31,
  },
  heroText: {
    color: '#ded8cf',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  categoryList: {
    gap: 8,
    paddingBottom: 18,
  },
  categoryButton: {
    borderColor: '#ded8cf',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  categoryButtonActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  categoryText: {
    color: '#5f5a55',
    fontSize: 14,
    fontWeight: '800',
  },
  categoryTextActive: {
    color: '#fff',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#111',
    fontSize: 22,
    fontWeight: '900',
  },
  productCount: {
    color: '#8a8178',
    fontSize: 13,
    fontWeight: '700',
  },
  productRow: {
    gap: 12,
  },
  productCard: {
    flex: 1,
    marginBottom: 18,
    maxWidth: '48.5%',
  },
  cardPressed: {
    opacity: 0.88,
  },
  productImageWrap: {
    aspectRatio: 0.78,
    backgroundColor: '#eee7dc',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  productImage: {
    height: '100%',
    width: '100%',
  },
  productPlaceholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  productPlaceholderText: {
    color: '#7a6f64',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  productBadge: {
    backgroundColor: '#fff',
    borderRadius: 6,
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 9,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  productBadgeText: {
    color: '#111',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  productCategory: {
    color: '#8a8178',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
    textTransform: 'uppercase',
  },
  productName: {
    color: '#111',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 4,
  },
  productDescription: {
    color: '#716b64',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  productPrice: {
    color: '#2c5c4a',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 6,
  },
  messageBox: {
    backgroundColor: '#fff',
    borderColor: '#eee0d2',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#ede7df',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 140,
    justifyContent: 'center',
    padding: 18,
  },
  messageTitle: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  messageText: {
    color: '#716b64',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
})
