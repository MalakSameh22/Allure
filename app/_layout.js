import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { Stack, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { I18nProvider } from '../lib/i18n'
import { CartProvider } from '../lib/cart'
import { WishlistProvider } from '../lib/wishlist'
import NetworkStatusBanner from '../components/NetworkStatusBanner'
import AuthScreen from '../screens/AuthScreen'

export default function RootLayout() {
  const pathname = usePathname()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const isPublicProductRoute = pathname?.startsWith('/product/')

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

  if (authLoading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.loading}>
          <StatusBar style="dark" />
          <ActivityIndicator color="#111" />
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <CartProvider>
          <WishlistProvider>
            <NetworkStatusBanner />
            {session || isPublicProductRoute ? (
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="cart" />
                <Stack.Screen name="orders" />
                <Stack.Screen name="product/[id]" />
              </Stack>
            ) : (
              <AuthScreen />
            )}
          </WishlistProvider>
        </CartProvider>
      </I18nProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#f7f5f1',
    flex: 1,
    justifyContent: 'center',
  },
})
