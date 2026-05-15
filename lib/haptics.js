import * as Haptics from 'expo-haptics'

async function safelyRunHaptic(action) {
  try {
    await action()
  } catch {}
}

export function hapticAddToCart() {
  return safelyRunHaptic(() =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  )
}

export function hapticSwipeAction() {
  return safelyRunHaptic(() => Haptics.selectionAsync())
}

export function hapticCheckoutSuccess() {
  return safelyRunHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  )
}

export function hapticWarning() {
  return safelyRunHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  )
}
