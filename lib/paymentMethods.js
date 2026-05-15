import * as SecureStore from 'expo-secure-store'

const STORE_KEY = 'allure_saved_cards_v1'

export async function getSavedCards() {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function saveCard({ brand, last4, expiry, cardholder }) {
  const cards = await getSavedCards()
  const id = `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const card = { id, brand, last4, expiry, cardholder }
  const updated = [...cards.slice(-4), card]
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(updated))
  return card
}

export async function deleteCard(id) {
  const cards = await getSavedCards()
  await SecureStore.setItemAsync(
    STORE_KEY,
    JSON.stringify(cards.filter((c) => c.id !== id))
  )
}
