import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'

export default function AddProductScreen() {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('')
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [barcode, setBarcode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  async function openScanner() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission()
      if (!granted) {
        Alert.alert('Camera required', 'Allow camera access to scan barcodes.')
        return
      }
    }
    setScanning(true)
  }

  function handleBarcodeScan({ data }) {
    setBarcode(data)
    setScanning(false)
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to pick an image.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    })

    if (!result.canceled && result.assets.length > 0) {
      setImageUrl(result.assets[0].uri)
    }
  }

  async function submit() {
    if (!name.trim()) {
      Alert.alert(t('missingField'), t('productNameRequired'))
      return
    }

    setSubmitting(true)

    const nextProduct = {
      product_name: name.trim(),
      price: price ? Number(price) : null,
      quantity: quantity ? Number(quantity) : 0,
      color: color.trim() || null,
      size: size.trim() || null,
      Image: imageUrl.trim() || null,
      barcode: barcode || null,
    }

    const typeId = Number(category.trim())
    if (!Number.isNaN(typeId) && category.trim()) {
      nextProduct.type_id = typeId
    }

    const { error } = await supabase.from('products').insert(nextProduct)

    setSubmitting(false)

    if (error) {
      Alert.alert('Failed to add product', error.message)
      return
    }

    Alert.alert(t('productAdded'), `"${name}" ${t('productAddedHelp')}`)
    setName('')
    setPrice('')
    setQuantity('')
    setCategory('')
    setColor('')
    setSize('')
    setImageUrl('')
    setBarcode('')
  }

  if (scanning) {
    return (
      <View style={styles.scannerScreen}>
        <StatusBar style="light" />
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'],
          }}
          onBarcodeScanned={handleBarcodeScan}
        />
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.scannerHint}>Align barcode within the frame</Text>
        </View>
        <Pressable onPress={() => setScanning(false)} style={styles.cancelScan}>
          <Text style={styles.cancelScanText}>Cancel</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.kicker}>Catalog management</Text>
            <Text style={styles.title}>{t('addProduct')}</Text>
          </View>

          <View style={styles.imageSection}>
            <Pressable onPress={pickImage} style={styles.imagePicker}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderIcon}>+</Text>
                  <Text style={styles.imagePlaceholderText}>{t('addPhoto')}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.barcodeRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Barcode"
              placeholderTextColor="#8f8f8f"
              value={barcode}
              onChangeText={setBarcode}
            />
            <Pressable onPress={openScanner} style={styles.scanButton}>
              <Text style={styles.scanButtonText}>Scan</Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder={t('productName')}
              placeholderTextColor="#8f8f8f"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Price"
              placeholderTextColor="#8f8f8f"
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
            />
            <TextInput
              style={styles.input}
              placeholder="Quantity"
              placeholderTextColor="#8f8f8f"
              keyboardType="number-pad"
              value={quantity}
              onChangeText={setQuantity}
            />
            <TextInput
              style={styles.input}
              placeholder="Category"
              placeholderTextColor="#8f8f8f"
              value={category}
              onChangeText={setCategory}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder={t('color')}
                placeholderTextColor="#8f8f8f"
                value={color}
                onChangeText={setColor}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder={t('size')}
                placeholderTextColor="#8f8f8f"
                value={size}
                onChangeText={setSize}
              />
            </View>
          </View>

          <Pressable
            onPress={submit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.buttonPressed,
              submitting && styles.buttonDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{t('addToCatalog')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#fbfaf8',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  kicker: {
    color: '#8a8178',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#111',
    fontSize: 30,
    fontWeight: '900',
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePicker: {
    width: 140,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#eee7dc',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imagePlaceholderIcon: {
    color: '#7a6f64',
    fontSize: 32,
    fontWeight: '300',
  },
  imagePlaceholderText: {
    color: '#7a6f64',
    fontSize: 13,
    fontWeight: '700',
  },
  barcodeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  scanButton: {
    alignItems: 'center',
    backgroundColor: '#1d1a18',
    borderRadius: 8,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  form: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
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
  halfInput: {
    flex: 1,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 54,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  scannerScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    borderColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    height: 200,
    width: 280,
  },
  scannerHint: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    opacity: 0.85,
  },
  cancelScan: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    bottom: 48,
    borderRadius: 8,
    left: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    position: 'absolute',
    right: 24,
  },
  cancelScanText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
})
