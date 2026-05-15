import { useMemo } from 'react'
import { StyleSheet, Text, useColorScheme, View } from 'react-native'
import * as Network from 'expo-network'

export default function NetworkStatusBanner() {
  const networkState = Network.useNetworkState()
  const colorScheme = useColorScheme()
  const styles = useMemo(
    () => createStyles(colorScheme === 'dark'),
    [colorScheme]
  )

  const isOffline =
    networkState.isConnected === false ||
    networkState.isInternetReachable === false ||
    networkState.type === Network.NetworkStateType.NONE

  if (!isOffline) return null

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Offline mode - showing cached data</Text>
    </View>
  )
}

function createStyles(isDark) {
  return StyleSheet.create({
    banner: {
      backgroundColor: isDark ? '#2f2418' : '#fff4d6',
      borderBottomColor: isDark ? '#5f4630' : '#ead28a',
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    text: {
      color: isDark ? '#f7d8a2' : '#6e4b00',
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
  })
}
