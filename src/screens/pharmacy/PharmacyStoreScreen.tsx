import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { friendlyError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { colors, fonts } from '../../theme';

type PharmacyRecord = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  license_number: string | null;
  license_path: string | null;
  is_verified: boolean;
  offers_lab_tests: boolean;
  lab_test_prices: Record<string, number> | null;
};

const LAB_TEST_TYPES: { key: string; label: string }[] = [
  { key: 'blood_sugar', label: 'Blood Sugar (Fasting)' },
  { key: 'full_blood_count', label: 'Full Blood Count' },
  { key: 'lipid_panel', label: 'Lipid Panel' },
  { key: 'malaria_typhoid', label: 'Malaria + Typhoid' },
  { key: 'blood_pressure', label: 'Blood Pressure Check' },
  { key: 'kidney_function', label: 'Kidney Function' },
];

export function PharmacyStoreScreen() {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<PharmacyRecord | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [licensePath, setLicensePath] = useState<string | null>(null);
  const [offersLabTests, setOffersLabTests] = useState(false);
  const [labTestPrices, setLabTestPrices] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();
      if (data) {
        setRecord(data);
        setName(data.name ?? '');
        setAddress(data.address ?? '');
        setPhone(data.phone ?? '');
        setLicenseNumber(data.license_number ?? '');
        setLicensePath(data.license_path ?? null);
        setOffersLabTests(data.offers_lab_tests ?? false);
        if (data.lab_test_prices) {
          const entries = Object.entries(data.lab_test_prices as Record<string, number>).map(
            ([key, value]) => [key, String(value)] as const,
          );
          setLabTestPrices(Object.fromEntries(entries));
        }
        if (data.latitude != null && data.longitude != null) {
          setCoords({ latitude: data.latitude, longitude: data.longitude });
        }
      }
      setLoading(false);
    })();
  }, []);

  const useMyLocation = async () => {
    if (locating) return;
    setMessage(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMessage({ kind: 'error', text: 'Location permission was denied.' });
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setMessage({ kind: 'error', text: 'Could not get your location. Try again.' });
    } finally {
      setLocating(false);
    }
  };

  const pickAndUploadLicense = async () => {
    if (uploading) return;
    setMessage(null);

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setMessage({ kind: 'error', text: 'You must be signed in.' });
      return;
    }

    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const extension = asset.name?.split('.').pop() ?? 'pdf';
      const path = `${userId}/license.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('pharmacy-licenses')
        .upload(path, blob, { upsert: true, contentType: asset.mimeType ?? 'application/octet-stream' });

      if (uploadError) {
        setMessage({ kind: 'error', text: friendlyError(uploadError) });
        return;
      }
      setLicensePath(path);
      setMessage({ kind: 'success', text: 'License uploaded.' });
    } catch {
      setMessage({ kind: 'error', text: 'Upload failed. Try again.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setMessage(null);

    if (!name.trim()) {
      setMessage({ kind: 'error', text: 'Please enter your pharmacy name.' });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setMessage({ kind: 'error', text: 'You must be signed in.' });
      return;
    }

    const priceEntries = Object.entries(labTestPrices)
      .map(([key, value]) => [key, Number(value)] as const)
      .filter(([, value]) => Number.isFinite(value) && value > 0);

    setSaving(true);
    const payload = {
      owner_id: userId,
      name: name.trim(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      license_number: licenseNumber.trim() || null,
      license_path: licensePath,
      offers_lab_tests: offersLabTests,
      lab_test_prices: Object.fromEntries(priceEntries),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('pharmacies')
      .upsert(payload, { onConflict: 'owner_id' });
    setSaving(false);

    if (error) {
      setMessage({ kind: 'error', text: friendlyError(error) });
      return;
    }
    setMessage({ kind: 'success', text: 'Pharmacy details saved.' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.screenTitle}>My Pharmacy</Text>
          <Text style={styles.sectionHint}>
            These details are shown to patients searching for nearby pharmacies. Your license is
            reviewed for verification and never shown publicly.
          </Text>

          {record?.is_verified ? (
            <View style={styles.verifiedBanner}>
              <MaterialCommunityIcons name="check-decagram" size={20} color={colors.darkAccentGreen} />
              <Text style={styles.verifiedText}>Verified pharmacy</Text>
            </View>
          ) : (
            <View style={styles.pendingBanner}>
              <Ionicons name="time-outline" size={20} color="#C77B00" />
              <Text style={styles.pendingText}>
                {licensePath ? 'Verification pending review.' : 'Upload your license to get verified.'}
              </Text>
            </View>
          )}

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Pharmacy Name</Text>
            <TextInput
              style={styles.input}
              placeholder="MedPlus Pharmacy"
              placeholderTextColor={colors.inputPlaceholder}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={styles.input}
              placeholder="18 Adeola Odeku St, Victoria Island"
              placeholderTextColor={colors.inputPlaceholder}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="+234 800 000 0000"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Store Location</Text>
            <Pressable style={styles.actionButton} onPress={useMyLocation}>
              {locating ? (
                <ActivityIndicator size="small" color={colors.darkAccentGreen} />
              ) : (
                <Ionicons name="locate" size={18} color={colors.darkAccentGreen} />
              )}
              <Text style={styles.actionButtonText}>
                {coords
                  ? `Pinned: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                  : 'Use my current location'}
              </Text>
            </Pressable>
            <Text style={styles.fieldHint}>
              Stand inside your pharmacy and tap to pin its exact location.
            </Text>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Government License Number</Text>
            <TextInput
              style={styles.input}
              placeholder="PCN/REG/12345"
              placeholderTextColor={colors.inputPlaceholder}
              autoCapitalize="characters"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>License Document</Text>
            <Pressable style={styles.actionButton} onPress={pickAndUploadLicense}>
              {uploading ? (
                <ActivityIndicator size="small" color={colors.darkAccentGreen} />
              ) : (
                <Ionicons name="document-attach-outline" size={18} color={colors.darkAccentGreen} />
              )}
              <Text style={styles.actionButtonText}>
                {licensePath ? 'License uploaded. Tap to replace' : 'Upload license (PDF or photo)'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.toggleCard}>
            <View style={styles.toggleTextColumn}>
              <Text style={styles.fieldLabel}>We offer lab tests</Text>
              <Text style={styles.fieldHint}>
                Patients booking lab tests will see your pharmacy as a provider.
              </Text>
            </View>
            <Switch
              value={offersLabTests}
              onValueChange={setOffersLabTests}
              trackColor={{ false: colors.border, true: colors.primaryGreen }}
              thumbColor={colors.white}
            />
          </View>

          {offersLabTests ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Lab Test Prices (optional)</Text>
              <Text style={styles.fieldHint}>
                Leave a test blank if you'd rather patients call to ask. The app never shows a
                price you haven't set yourself.
              </Text>
              <View style={styles.priceList}>
                {LAB_TEST_TYPES.map((test) => (
                  <View key={test.key} style={styles.priceRow}>
                    <Text style={styles.priceLabel}>{test.label}</Text>
                    <View style={styles.priceInputWrap}>
                      <Text style={styles.priceCurrency}>₦</Text>
                      <TextInput
                        style={styles.priceInput}
                        placeholder="—"
                        placeholderTextColor={colors.inputPlaceholder}
                        keyboardType="numeric"
                        value={labTestPrices[test.key] ?? ''}
                        onChangeText={(value) =>
                          setLabTestPrices((prev) => ({ ...prev, [test.key]: value }))
                        }
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {message ? (
            <Text style={message.kind === 'error' ? styles.errorText : styles.successText}>
              {message.text}
            </Text>
          ) : null}

          {saving ? (
            <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
          ) : (
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Details</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  loader: {
    marginTop: 80,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  screenTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  sectionHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 6,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  verifiedText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.darkAccentGreen,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4E0',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  pendingText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: '#C77B00',
  },
  fieldBlock: {
    marginTop: 18,
  },
  fieldLabel: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    lineHeight: 19.6,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  fieldHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 6,
  },
  priceList: {
    marginTop: 12,
    gap: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  priceLabel: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 110,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
  },
  priceCurrency: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textMuted,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 18,
  },
  toggleTextColumn: {
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryGreen,
    paddingVertical: 13,
  },
  actionButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.darkAccentGreen,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 16,
  },
  successText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
    textAlign: 'center',
    marginTop: 16,
  },
  spinner: {
    height: 56,
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: colors.primaryGreen,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
});
