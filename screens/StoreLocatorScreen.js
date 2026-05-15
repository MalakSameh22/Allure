import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker } from 'react-native-maps'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '../lib/i18n'
import { useOfflineStores } from '../offline-browsing/useOfflineStores'

export default function StoreLocatorScreen() {
  const colorScheme = useColorScheme()
  const { t } = useI18n()
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme
  const styles = useMemo(() => createStyles(theme), [theme])
  const {
    stores,
    loading: storesLoading,
    refreshing,
    isOffline,
    syncPausedBattery,
    error,
    reload,
  } = useOfflineStores()
  const [userLocation, setUserLocation] = useState(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [selectedStore, setSelectedStore] = useState(null)
  const mapRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    requestLocation()
  }, [])

  async function requestLocation() {
    setPermissionDenied(false)
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      setPermissionDenied(true)
      return
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    setUserLocation(loc.coords)
  }

  const normalizedStores = useMemo(() => stores.map(normalizeStore), [stores])
  const mappableStores = useMemo(
    () => normalizedStores.filter((s) => hasCoordinates(s)),
    [normalizedStores]
  )

  const mapRegion = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      }
    }
    if (mappableStores[0]) {
      return {
        latitude: mappableStores[0].latitude,
        longitude: mappableStores[0].longitude,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      }
    }
    return { latitude: 30.0444, longitude: 31.2357, latitudeDelta: 0.3, longitudeDelta: 0.3 }
  }, [userLocation, mappableStores])

  function handleSelectStore(store) {
    const isSame = selectedStore?.id === store.id
    const next = isSame ? null : store
    setSelectedStore(next)

    if (next && hasCoordinates(next) && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: next.latitude,
          longitude: next.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        },
        500
      )
    }
  }

  function openDirections(store) {
    if (!hasCoordinates(store)) return
    const { latitude, longitude, name } = store
    const label = encodeURIComponent(name)
    const url =
      Platform.OS === 'ios'
        ? `maps:0,0?q=${label}@${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`)
    )
  }

  function getDistanceLabel(store) {
    if (!userLocation || !hasCoordinates(store)) return null
    const R = 6371
    const dLat = toRad(store.latitude - userLocation.latitude)
    const dLon = toRad(store.longitude - userLocation.longitude)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(userLocation.latitude)) *
        Math.cos(toRad(store.latitude)) *
        Math.sin(dLon / 2) ** 2
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`
  }

  const loading = storesLoading

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{t('findUsNearby')}</Text>
          <Text style={styles.title}>{t('stores')}</Text>
        </View>
        {!storesLoading && normalizedStores.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{normalizedStores.length}</Text>
          </View>
        )}
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={13} color={theme.bannerText} style={{ marginRight: 6 }} />
          <Text style={styles.offlineBannerText}>{t('offlineStores')}</Text>
        </View>
      )}
      {syncPausedBattery && (
        <View style={styles.offlineBanner}>
          <Ionicons name="battery-dead-outline" size={13} color={theme.bannerText} style={{ marginRight: 6 }} />
          <Text style={styles.offlineBannerText}>Sync paused to conserve battery</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.text} size="large" />
          <Text style={styles.loadingText}>{t('loadingStores')}</Text>
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
            showsUserLocation
            showsMyLocationButton
          >
            {mappableStores.map((store) => (
              <Marker
                key={String(store.id)}
                coordinate={{ latitude: store.latitude, longitude: store.longitude }}
                title={store.name}
                description={store.address}
                pinColor={selectedStore?.id === store.id ? '#6849a7' : '#111'}
                onPress={() => handleSelectStore(store)}
              />
            ))}
          </MapView>

          <ScrollView
            ref={scrollRef}
            style={styles.listContainer}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => reload(true)}
                tintColor={theme.text}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {error ? (
              <View style={styles.messageBox}>
                <View style={styles.messageRow}>
                  <Ionicons name="warning-outline" size={17} color={theme.text} />
                  <Text style={styles.errorTitle}>{t('couldNotLoadStores')}</Text>
                </View>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => reload()} style={styles.retryButton}>
                  <Text style={styles.retryText}>{t('tryAgain')}</Text>
                </Pressable>
              </View>
            ) : null}

            {!error && permissionDenied ? (
              <View style={styles.messageBox}>
                <View style={styles.messageRow}>
                  <Ionicons name="location-outline" size={17} color={theme.text} />
                  <Text style={styles.errorTitle}>{t('locationAccessNeeded')}</Text>
                </View>
                <Text style={styles.errorText}>{t('locationHelp')}</Text>
                <Pressable onPress={requestLocation} style={styles.retryButton}>
                  <Text style={styles.retryText}>{t('allowLocation')}</Text>
                </Pressable>
              </View>
            ) : null}

            {!error && normalizedStores.length === 0 ? (
              <View style={styles.messageBox}>
                <View style={styles.messageRow}>
                  <Ionicons name="storefront-outline" size={17} color={theme.text} />
                  <Text style={styles.errorTitle}>{t('noStores')}</Text>
                </View>
                <Text style={styles.errorText}>{t('noStoresHelp')}</Text>
              </View>
            ) : null}

            {normalizedStores.map((store) => {
              const active = selectedStore?.id === store.id
              const distance = getDistanceLabel(store)
              const onMap = hasCoordinates(store)

              return (
                <Pressable
                  key={String(store.id)}
                  onPress={() => handleSelectStore(store)}
                  style={({ pressed }) => [
                    styles.storeCard,
                    active && styles.storeCardActive,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.storeTop}>
                    <Text
                      style={[styles.storeName, active && styles.storeNameActive]}
                      numberOfLines={1}
                    >
                      {store.name}
                    </Text>
                    <View style={styles.storeTopRight}>
                      {distance ? (
                        <Text style={styles.distanceText}>{distance}</Text>
                      ) : null}
                      <View style={[styles.mapBadge, active && styles.mapBadgeActive]}>
                        <Ionicons
                          name={onMap ? 'map' : 'map-outline'}
                          size={12}
                          color={active ? theme.screen : onMap ? theme.primary : theme.subtle}
                        />
                      </View>
                    </View>
                  </View>

                  {store.address ? (
                    <View style={styles.storeRow}>
                      <Ionicons
                        name="location-outline"
                        size={13}
                        color={theme.subtle}
                        style={styles.rowIcon}
                      />
                      <Text style={styles.storeAddress}>{store.address}</Text>
                    </View>
                  ) : null}

                  {store.location ? (
                    <View style={styles.storeRow}>
                      <Ionicons
                        name="business-outline"
                        size={13}
                        color={theme.subtle}
                        style={styles.rowIcon}
                      />
                      <Text style={styles.storeLocation}>{store.location}</Text>
                    </View>
                  ) : null}

                  {store.hours ? (
                    <View style={styles.storeRow}>
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color={theme.subtle}
                        style={styles.rowIcon}
                      />
                      <Text style={styles.storeHours}>{store.hours}</Text>
                    </View>
                  ) : null}

                  {onMap && active ? (
                    <Pressable
                      onPress={() => openDirections(store)}
                      style={styles.directionsButton}
                    >
                      <Ionicons name="navigate" size={14} color={theme.screen} />
                      <Text style={styles.directionsText}>{t('getDirections')}</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              )
            })}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  )
}

function normalizeStore(store) {
  const latRaw = store.latitude ?? store.lat ?? store.Latitude ?? store.Lat
  const lngRaw = store.longitude ?? store.lng ?? store.long ?? store.Longitude ?? store.Lng
  const latitude = latRaw != null ? Number(latRaw) : NaN
  const longitude = lngRaw != null ? Number(lngRaw) : NaN

  return {
    id: store.store_id ?? store.id ?? store.uuid ?? store.store_name ?? store.name,
    name: store.store_name ?? store.name ?? 'Allure Store',
    address: store.address ?? store.area ?? '',
    hours: store.hours ?? store.opening_hours ?? store.working_hours ?? '',
    location: store.location ?? store.city ?? store.governorate ?? '',
    latitude,
    longitude,
  }
}

function hasCoordinates(store) {
  return Number.isFinite(store.latitude) && Number.isFinite(store.longitude)
}

function toRad(deg) {
  return (deg * Math.PI) / 180
}

const lightTheme = {
  screen: '#fbfaf8',
  text: '#111',
  muted: '#716b64',
  subtle: '#8a8178',
  border: '#e8e2d9',
  card: '#fff',
  banner: '#1d1a18',
  bannerText: '#ded8cf',
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
  banner: '#070707',
  bannerText: '#c8bfb3',
  primary: '#a98ddf',
  countBg: '#2a2438',
  countText: '#a98ddf',
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: {
      backgroundColor: theme.screen,
      flex: 1,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 8,
    },
    kicker: {
      color: theme.subtle,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    title: {
      color: theme.text,
      fontSize: 30,
      fontWeight: '900',
    },
    countBadge: {
      alignItems: 'center',
      backgroundColor: theme.countBg,
      borderRadius: 20,
      justifyContent: 'center',
      minWidth: 34,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    countBadgeText: {
      color: theme.countText,
      fontSize: 14,
      fontWeight: '900',
    },
    offlineBanner: {
      alignItems: 'center',
      backgroundColor: theme.banner,
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    offlineBannerText: {
      color: theme.bannerText,
      fontSize: 12,
      fontWeight: '700',
    },
    center: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 32,
    },
    loadingText: {
      color: theme.subtle,
      fontSize: 14,
      marginTop: 12,
    },
    map: {
      height: 260,
      width: '100%',
    },
    listContainer: {
      flex: 1,
    },
    list: {
      gap: 10,
      padding: 16,
      paddingBottom: 28,
    },
    messageBox: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 10,
      borderWidth: 1,
      padding: 16,
    },
    messageRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      marginBottom: 6,
    },
    errorTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '900',
    },
    errorText: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 14,
    },
    retryButton: {
      alignItems: 'center',
      backgroundColor: theme.text,
      borderRadius: 8,
      justifyContent: 'center',
      minHeight: 44,
    },
    retryText: {
      color: theme.screen,
      fontSize: 14,
      fontWeight: '800',
    },
    storeCard: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 10,
      borderWidth: 1,
      padding: 14,
    },
    storeCardActive: {
      borderColor: theme.primary,
      borderWidth: 1.5,
    },
    cardPressed: {
      opacity: 0.88,
    },
    storeTop: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    storeName: {
      color: theme.text,
      flex: 1,
      fontSize: 15,
      fontWeight: '800',
      marginRight: 8,
    },
    storeNameActive: {
      color: theme.primary,
    },
    storeTopRight: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    distanceText: {
      color: theme.subtle,
      fontSize: 12,
      fontWeight: '700',
    },
    mapBadge: {
      alignItems: 'center',
      backgroundColor: theme.border,
      borderRadius: 6,
      height: 24,
      justifyContent: 'center',
      width: 24,
    },
    mapBadgeActive: {
      backgroundColor: theme.primary,
    },
    storeRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      marginTop: 4,
    },
    rowIcon: {
      marginRight: 6,
      marginTop: 1,
    },
    storeAddress: {
      color: theme.muted,
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
    storeLocation: {
      color: theme.muted,
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
    },
    storeHours: {
      color: theme.subtle,
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    directionsButton: {
      alignItems: 'center',
      backgroundColor: theme.primary,
      borderRadius: 8,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      marginTop: 12,
      minHeight: 40,
    },
    directionsText: {
      color: theme.screen,
      fontSize: 13,
      fontWeight: '800',
    },
  })
}
