import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../../components/ui/BounceIn';
import { PatternBackground } from '../../components/ui/PatternBackground';
import {
  addMedicine,
  deleteMedicine,
  fetchMyMedicines,
  fetchMyPharmacyId,
  setMedicineStock,
  type Medicine,
} from '../../lib/pharmacyMedicines';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PharmacyMedicines'>;

export function PharmacyMedicinesScreen({ navigation }: Props) {
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState('');
  const [form, setForm] = useState('');
  const [price, setPrice] = useState('');
  const [inStock, setInStock] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const id = await fetchMyPharmacyId();
    setPharmacyId(id);
    if (id) setMedicines(await fetchMyMedicines(id));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAdd = async () => {
    if (adding || !pharmacyId) return;
    setError(null);
    if (!name.trim()) {
      setError('Please enter the medicine name.');
      return;
    }
    let priceNum: number | null = null;
    if (price.trim()) {
      const raw = Number(price);
      if (!Number.isFinite(raw) || raw <= 0) {
        setError('Please enter a valid price, or leave it blank.');
        return;
      }
      priceNum = Math.round(raw);
    }
    setAdding(true);
    const { medicine, error: addError } = await addMedicine(pharmacyId, {
      name,
      form: form || null,
      price: priceNum,
      in_stock: inStock,
    });
    setAdding(false);
    if (addError || !medicine) {
      setError(addError ?? 'Could not add the medicine. Please try again.');
      return;
    }
    setMedicines((prev) => [...prev, medicine].sort((a, b) => a.name.localeCompare(b.name)));
    setName('');
    setForm('');
    setPrice('');
    setInStock(true);
  };

  const toggleStock = async (medicine: Medicine) => {
    const next = !medicine.in_stock;
    setMedicines((prev) => prev.map((m) => (m.id === medicine.id ? { ...m, in_stock: next } : m)));
    const ok = await setMedicineStock(medicine.id, next);
    if (!ok) {
      setMedicines((prev) =>
        prev.map((m) => (m.id === medicine.id ? { ...m, in_stock: medicine.in_stock } : m)),
      );
    }
  };

  const removeMedicine = async (medicine: Medicine) => {
    const previous = medicines;
    setMedicines((prev) => prev.filter((m) => m.id !== medicine.id));
    const ok = await deleteMedicine(medicine.id);
    if (!ok) setMedicines(previous);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>My Medicines</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
        ) : !pharmacyId ? (
          <View style={styles.emptyCard}>
            <BounceIn style={styles.emptyIcon}>
              <Ionicons name="storefront-outline" size={26} color={colors.darkAccentGreen} />
            </BounceIn>
            <Text style={styles.emptyTitle}>Set up your store first</Text>
            <Text style={styles.emptyBody}>
              Add your pharmacy details in My Store, then come back to list the medicines you stock.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primaryGreen}
                colors={[colors.primaryGreen]}
              />
            }
          >
            <Text style={styles.sectionHint}>
              List the medicines you stock so patients nearby can find you when they need them.
              Turn a medicine off when you run out, and back on when it is back.
            </Text>

            {/* Add form */}
            <View style={styles.addCard}>
              <Text style={styles.addTitle}>Add a medicine</Text>
              <TextInput
                style={styles.input}
                placeholder="Medicine name (e.g. Paracetamol)"
                placeholderTextColor={colors.inputPlaceholder}
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={styles.input}
                placeholder="Form or strength (optional, e.g. 500mg tablets)"
                placeholderTextColor={colors.inputPlaceholder}
                value={form}
                onChangeText={setForm}
              />
              <View style={styles.rowInputs}>
                <View style={styles.priceWrap}>
                  <Text style={styles.priceCurrency}>₦</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Price (optional)"
                    placeholderTextColor={colors.inputPlaceholder}
                    keyboardType="numeric"
                    value={price}
                    onChangeText={setPrice}
                  />
                </View>
                <View style={styles.stockToggle}>
                  <Text style={styles.stockToggleLabel}>In stock</Text>
                  <Switch
                    value={inStock}
                    onValueChange={setInStock}
                    trackColor={{ false: colors.border, true: colors.primaryGreen }}
                    thumbColor={colors.white}
                  />
                </View>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable
                style={[styles.addButton, adding && styles.addButtonDisabled]}
                onPress={handleAdd}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="add" size={18} color={colors.white} />
                    <Text style={styles.addButtonText}>Add medicine</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* List */}
            <Text style={styles.listTitle}>
              Your medicines{medicines.length > 0 ? ` (${medicines.length})` : ''}
            </Text>
            {medicines.length === 0 ? (
              <View style={styles.listEmpty}>
                <MaterialCommunityIcons name="pill" size={22} color={colors.textMuted} />
                <Text style={styles.listEmptyText}>
                  No medicines yet. Add your first one above.
                </Text>
              </View>
            ) : (
              medicines.map((medicine) => (
                <View key={medicine.id} style={styles.medRow}>
                  <View style={styles.medTextColumn}>
                    <Text style={styles.medName}>{medicine.name}</Text>
                    <Text style={styles.medMeta}>
                      {[medicine.form, medicine.price != null ? `₦${medicine.price.toLocaleString()}` : null]
                        .filter(Boolean)
                        .join(' · ') || 'No extra details'}
                    </Text>
                    <Text style={[styles.medStock, medicine.in_stock ? styles.medIn : styles.medOut]}>
                      {medicine.in_stock ? 'In stock' : 'Out of stock'}
                    </Text>
                  </View>
                  <Switch
                    value={medicine.in_stock}
                    onValueChange={() => toggleStock(medicine)}
                    trackColor={{ false: colors.border, true: colors.primaryGreen }}
                    thumbColor={colors.white}
                  />
                  <Pressable onPress={() => removeMedicine(medicine)} hitSlop={8} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={19} color={colors.danger} />
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  loader: {
    marginTop: 80,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sectionHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  addCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  addTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15.5,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  priceWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  priceCurrency: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textMuted,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  stockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockToggleLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.danger,
    marginTop: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryGreen,
    borderRadius: 24,
    height: 48,
    marginTop: 14,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.white,
  },
  listTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 24,
    marginBottom: 4,
  },
  listEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 10,
  },
  listEmptyText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  medTextColumn: {
    flex: 1,
  },
  medName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  medMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  medStock: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    marginTop: 4,
  },
  medIn: {
    color: colors.darkAccentGreen,
  },
  medOut: {
    color: colors.textMuted,
  },
  deleteButton: {
    padding: 4,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 28,
    marginHorizontal: 24,
    marginTop: 40,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 14,
  },
  emptyBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
});
