import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'

export default function AuthScreen() {
  const { t } = useI18n()
  const [mode, setMode] = useState('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === 'signUp'

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert(t('missingDetails'), t('missingDetailsHelp'))
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
    }
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <Text style={styles.logo}>Allure</Text>
            <Text style={styles.title}>{isSignUp ? t('createYourAccount') : t('welcomeBack')}</Text>
            <Text style={styles.subtitle}>{t('authSubtitle')}</Text>
          </View>

          <View style={styles.modeControl}>
            <Pressable
              style={[styles.modeButton, !isSignUp && styles.modeButtonActive]}
              onPress={() => setMode('signIn')}
            >
              <Text style={[styles.modeText, !isSignUp && styles.modeTextActive]}>{t('signIn')}</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, isSignUp && styles.modeButtonActive]}
              onPress={() => setMode('signUp')}
            >
              <Text style={[styles.modeText, isSignUp && styles.modeTextActive]}>{t('signUp')}</Text>
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
              placeholder={t('password')}
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
                <Text style={styles.primaryButtonText}>{isSignUp ? t('createAccount') : t('signIn')}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f5f1',
  },
  keyboard: {
    flex: 1,
  },
  content: {
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
  title: {
    color: '#111',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 42,
    maxWidth: 320,
  },
  subtitle: {
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
})
