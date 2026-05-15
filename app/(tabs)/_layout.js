import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { useColorScheme } from 'react-native'
import { useI18n } from '../../lib/i18n'

const TAB_ICONS = {
  index: ['grid', 'grid-outline'],
  stores: ['location', 'location-outline'],
  add: ['add-circle', 'add-circle-outline'],
  profile: ['person', 'person-outline'],
}

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const { t } = useI18n()
  const isDark = colorScheme === 'dark'

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: isDark ? '#f5f1ea' : '#111',
        tabBarInactiveTintColor: isDark ? '#9b9187' : '#8a8178',
        tabBarStyle: {
          backgroundColor: isDark ? '#151515' : '#fbfaf8',
          borderTopColor: isDark ? '#3a342e' : '#e8e2d9',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const [activeIcon, inactiveIcon] = TAB_ICONS[route.name] ?? ['help', 'help-outline']
          return <Ionicons name={focused ? activeIcon : inactiveIcon} size={size} color={color} />
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: t('home') }} />
      <Tabs.Screen name="stores" options={{ title: t('stores') }} />
      <Tabs.Screen name="add" options={{ title: t('add') }} />
      <Tabs.Screen name="profile" options={{ title: t('profile') }} />
    </Tabs>
  )
}
