import { createContext, useContext, useMemo, useState } from 'react'
import { getLocales, useLocales } from 'expo-localization'

const REGION_KEY = 'allure_region'

export const REGIONS = [
  { code: 'EG', flag: '🇪🇬', label: 'Egypt',         language: 'en', currencyCode: 'EGP', currencySymbol: 'E£', localeTag: 'en-EG' },
  { code: 'US', flag: '🇺🇸', label: 'United States',  language: 'en', currencyCode: 'USD', currencySymbol: '$',  localeTag: 'en-US' },
  { code: 'DE', flag: '🇩🇪', label: 'Germany',        language: 'de', currencyCode: 'EUR', currencySymbol: '€',  localeTag: 'de-DE' }   
]

function detectInitialRegion(deviceLocale) {
  const saved = global.localStorage?.getItem(REGION_KEY)
  if (saved) {
    const r = REGIONS.find((r) => r.code === saved)
    if (r) return r
  }
  // Migrate old language-only preference
  const savedLang = global.localStorage?.getItem('allure_language')
  if (savedLang === 'de') return REGIONS.find((r) => r.code === 'DE')
  // Match device currency
  const currency = deviceLocale?.currencyCode
  if (currency) {
    const r = REGIONS.find((r) => r.currencyCode === currency)
    if (r) return r
  }
  return REGIONS[0] // Egypt default
}

const translations = {
  en: {
    add: 'Add',
    addImage: 'Add image',
    addPhoto: 'Add photo',
    addProduct: 'Add Product',
    addToCart: 'Add to cart',
    addToCatalog: 'Add to catalog',
    addressUnavailable: 'Address unavailable',
    all: 'All',
    allowLocation: 'Allow location',
    back: 'Back',
    barcode: 'Barcode',
    cached: 'cached',
    cartEmpty: 'Your cart is empty',
    cartEmptyHelp: 'Browse products and add items to your cart.',
    checkout: 'Checkout',
    close: 'Close',
    color: 'Color',
    couldNotLoadProducts: 'Could not load products',
    couldNotLoadStores: 'Could not load stores',
    couldNotRemoveProduct: 'Could not remove product',
    couldNotUpdateImage: 'Could not update image',
    createAccount: 'Create account',
    createYourAccount: 'Create your account',
    currency: 'Currency',
    darkMode: 'Dark mode',
    deviceLanguage: 'Device language',
    fashion: 'Fashion',
    findUsNearby: 'Find us nearby',
    getDirections: 'Get directions',
    heroTitle: 'Fashion pieces selected for your next look',
    home: 'Home',
    items: 'items',
    language: 'Language',
    lightMode: 'Light mode',
    loadingStores: 'Loading stores...',
    loadMore: 'Load more',
    locationAccessNeeded: 'Location access needed',
    locationHelp: 'Allow location access to show your position on the map.',
    locations: 'Locations',
    memberSince: 'Member since',
    missingDetails: 'Missing details',
    missingDetailsHelp: 'Enter your email and password to continue.',
    missingField: 'Missing field',
    newSeasonEdit: 'New season edit',
    noOrders: 'No orders yet',
    noOrdersHelp: 'Place an order from your shopping cart to see it here.',
    noProducts: 'No products yet',
    noProductsHelp: 'Add rows to your Supabase Products table to show them here.',
    noStores: 'No stores yet',
    noStoresHelp: 'Add rows to your Supabase Stores table to show them here.',
    noViewedProducts: 'No viewed products yet',
    noWishlist: 'No wishlist items yet',
    noWishlistHelp: 'Tap ♥ on any product to save it here.',
    offlineProducts: "You're offline - showing cached products",
    offlineStores: "You're offline - showing cached stores",
    orderDate: 'Ordered',
    orderError: 'Could not place order',
    orderHistory: 'Order history',
    orderItems: 'items',
    orderPlaced: 'Order placed!',
    orderPlacedHelp: 'Your order has been submitted successfully.',
    orders: 'Orders',
    orderStatus: 'Status',
    orderTotal: 'Total',
    other: 'Other',
    password: 'Password',
    permissionNeeded: 'Permission needed',
    photoPermissionHelp: 'Allow photo library access to pick an image.',
    placeOrder: 'Place order',
    priceOnRequest: 'Price on request',
    productAdded: 'Product added',
    productAddedHelp: 'was added to the catalog.',
    productName: 'Product name *',
    productNameRequired: 'Product name is required.',
    products: 'Products',
    profile: 'Profile',
    qty: 'Qty',
    recentlyViewed: 'Recently Viewed',
    region: 'Region',
    remove: 'Remove',
    removeFromCart: 'Remove',
    removeProduct: 'Remove product',
    removeProductBody: 'This will remove the product from Supabase.',
    selectRegion: 'Select region',
    shopHero: 'Shop elevated essentials and statement styles.',
    shoppingCart: 'Shopping Cart',
    signIn: 'Sign in',
    signOut: 'Sign out',
    signUp: 'Sign up',
    size: 'Size',
    statusConfirmed: 'Confirmed',
    statusDelivered: 'Delivered',
    statusPending: 'Pending',
    statusShipped: 'Shipped',
    stores: 'Stores',
    subtotal: 'Subtotal',
    theme: 'Theme',
    tryAgain: 'Try again',
    view: 'View',
    viewOrder: 'View details',
    viewedHelp: 'Products you open from Home are saved here for offline browsing.',
    welcomeBack: 'Welcome back',
    authSubtitle: 'Curated fashion drops, styled picks, and new-season essentials.',
    wishlist: 'Wishlist',
    working: 'Working...',
    yourAccount: 'Your account',
  },
  de: {
    add: 'Hinzufügen',
    addImage: 'Bild hinzufügen',
    addPhoto: 'Foto hinzufügen',
    addProduct: 'Produkt hinzufügen',
    addToCart: 'In den Warenkorb',
    addToCatalog: 'Zum Katalog hinzufügen',
    addressUnavailable: 'Adresse nicht verfügbar',
    all: 'Alle',
    allowLocation: 'Standort erlauben',
    back: 'Zurück',
    barcode: 'Barcode',
    cached: 'gespeichert',
    cartEmpty: 'Dein Warenkorb ist leer',
    cartEmptyHelp: 'Stöbere in Produkten und füge Artikel hinzu.',
    checkout: 'Kasse',
    close: 'Schließen',
    color: 'Farbe',
    couldNotLoadProducts: 'Produkte konnten nicht geladen werden',
    couldNotLoadStores: 'Standorte konnten nicht geladen werden',
    couldNotRemoveProduct: 'Produkt konnte nicht entfernt werden',
    couldNotUpdateImage: 'Bild konnte nicht aktualisiert werden',
    createAccount: 'Konto erstellen',
    createYourAccount: 'Erstelle dein Konto',
    currency: 'Währung',
    darkMode: 'Dunkler Modus',
    deviceLanguage: 'Gerätesprache',
    fashion: 'Mode',
    findUsNearby: 'Finde uns in der Nähe',
    getDirections: 'Route berechnen',
    heroTitle: 'Ausgewählte Fashion-Pieces für deinen nächsten Look',
    home: 'Start',
    items: 'Artikel',
    language: 'Sprache',
    lightMode: 'Heller Modus',
    loadingStores: 'Standorte werden geladen...',
    loadMore: 'Mehr laden',
    locationAccessNeeded: 'Standortzugriff erforderlich',
    locationHelp: 'Erlaube den Standortzugriff, um deine Position auf der Karte zu sehen.',
    locations: 'Standorte',
    memberSince: 'Mitglied seit',
    missingDetails: 'Angaben fehlen',
    missingDetailsHelp: 'Gib deine E-Mail-Adresse und dein Passwort ein.',
    missingField: 'Feld fehlt',
    newSeasonEdit: 'Neue Saison',
    noOrders: 'Noch keine Bestellungen',
    noOrdersHelp: 'Gib eine Bestellung aus deinem Warenkorb auf, um sie hier zu sehen.',
    noProducts: 'Noch keine Produkte',
    noProductsHelp: 'Füge Zeilen zur Supabase-Tabelle Products hinzu, um sie hier anzuzeigen.',
    noStores: 'Noch keine Standorte',
    noStoresHelp: 'Füge Zeilen zur Supabase-Tabelle Stores hinzu, um sie hier anzuzeigen.',
    noViewedProducts: 'Noch keine angesehenen Produkte',
    noWishlist: 'Keine Wunschliste vorhanden',
    noWishlistHelp: 'Tippe auf ♥ bei einem Produkt, um es zu speichern.',
    offlineProducts: 'Du bist offline - gespeicherte Produkte werden angezeigt',
    offlineStores: 'Du bist offline - gespeicherte Standorte werden angezeigt',
    orderDate: 'Bestellt am',
    orderError: 'Bestellung konnte nicht aufgegeben werden',
    orderHistory: 'Bestellhistorie',
    orderItems: 'Artikel',
    orderPlaced: 'Bestellung aufgegeben!',
    orderPlacedHelp: 'Deine Bestellung wurde erfolgreich übermittelt.',
    orders: 'Bestellungen',
    orderStatus: 'Status',
    orderTotal: 'Gesamt',
    other: 'Andere',
    password: 'Passwort',
    permissionNeeded: 'Berechtigung erforderlich',
    photoPermissionHelp: 'Erlaube den Zugriff auf deine Fotos, um ein Bild auszuwählen.',
    placeOrder: 'Bestellung aufgeben',
    priceOnRequest: 'Preis auf Anfrage',
    productAdded: 'Produkt hinzugefügt',
    productAddedHelp: 'wurde zum Katalog hinzugefügt.',
    productName: 'Produktname *',
    productNameRequired: 'Der Produktname ist erforderlich.',
    products: 'Produkte',
    profile: 'Profil',
    qty: 'Menge',
    recentlyViewed: 'Zuletzt angesehen',
    region: 'Region',
    remove: 'Entfernen',
    removeFromCart: 'Entfernen',
    removeProduct: 'Produkt entfernen',
    removeProductBody: 'Dadurch wird das Produkt aus Supabase entfernt.',
    selectRegion: 'Region auswählen',
    shopHero: 'Entdecke hochwertige Essentials und Statement-Styles.',
    shoppingCart: 'Warenkorb',
    signIn: 'Anmelden',
    signOut: 'Abmelden',
    signUp: 'Registrieren',
    size: 'Größe',
    statusConfirmed: 'Bestätigt',
    statusDelivered: 'Geliefert',
    statusPending: 'Ausstehend',
    statusShipped: 'Versendet',
    stores: 'Standorte',
    subtotal: 'Zwischensumme',
    theme: 'Design',
    tryAgain: 'Erneut versuchen',
    view: 'Ansehen',
    viewOrder: 'Details ansehen',
    viewedHelp: 'Produkte, die du auf der Startseite öffnest, werden hier offline gespeichert.',
    welcomeBack: 'Willkommen zurück',
    authSubtitle: 'Kuratierte Fashion-Drops, Styling-Favoriten und Essentials der neuen Saison.',
    wishlist: 'Wunschliste',
    working: 'Läuft...',
    yourAccount: 'Dein Konto',
  },
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const locales = useLocales()
  const deviceLocale = locales[0] ?? getLocales()[0]

  const [region, setRegionState] = useState(() => detectInitialRegion(deviceLocale))

  const value = useMemo(() => {
    const dictionary = translations[region.language] ?? translations.en

    return {
      region,
      regions: REGIONS,
      language: region.language,
      currencyCode: region.currencyCode,
      currencySymbol: region.currencySymbol,
      priceLocale: region.localeTag,
      localeTag: region.localeTag,
      deviceLanguageTag: deviceLocale?.languageTag ?? 'en-US',
      setRegion(nextRegion) {
        setRegionState(nextRegion)
        global.localStorage?.setItem(REGION_KEY, nextRegion.code)
      },
      // kept for backward-compat
      setLanguage(lang) {
        const r = REGIONS.find((r) => r.language === lang) ?? REGIONS[0]
        setRegionState(r)
        global.localStorage?.setItem(REGION_KEY, r.code)
      },
      t(key) {
        return dictionary[key] ?? translations.en[key] ?? key
      },
    }
  }, [region, deviceLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used within I18nProvider')
  return value
}

export function formatLocalizedPrice(value, i18n) {
  if (value === null || value === undefined || value === '') return i18n.t('priceOnRequest')
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)

  try {
    return new Intl.NumberFormat(i18n.priceLocale ?? i18n.localeTag, {
      currency: i18n.currencyCode,
      style: 'currency',
    }).format(n)
  } catch {
    return `${i18n.currencySymbol}${n.toFixed(2)}`
  }
}
