import { useMemo } from 'react'
import * as Battery from 'expo-battery'

const CRITICAL_BATTERY_LEVEL = 0.1

export function useBatteryAwareSync() {
  const batteryState = Battery.useBatteryState()
  const powerState = Battery.usePowerState()

  return useMemo(() => {
    const batteryLevel = powerState.batteryLevel
    const isKnownLevel = typeof batteryLevel === 'number' && batteryLevel >= 0
    const isCharging =
      batteryState === Battery.BatteryState.CHARGING ||
      batteryState === Battery.BatteryState.FULL
    const isCriticallyLow =
      isKnownLevel && batteryLevel <= CRITICAL_BATTERY_LEVEL && !isCharging
    const isLowPowerMode = Boolean(powerState.lowPowerMode)

    return {
      batteryLevel,
      isCriticallyLow,
      isLowPowerMode,
      shouldPauseSync: isCriticallyLow || isLowPowerMode,
    }
  }, [batteryState, powerState])
}
