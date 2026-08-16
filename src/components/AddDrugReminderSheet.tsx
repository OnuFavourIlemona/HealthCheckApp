import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, fonts } from '../theme';
import type { DrugReminderTime } from '../lib/drugReminders';

type Props = {
  visible: boolean;
  submitting: boolean;
  error: string | null;
  /** Present when editing an existing reminder, prefilling the form. */
  initial?: { drugName: string; dosage: string; times: DrugReminderTime[] } | null;
  onSubmit: (drugName: string, dosage: string, times: DrugReminderTime[]) => void;
  onDismiss: () => void;
};

function defaultTime(): Date {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return d;
}

function toDate(t: DrugReminderTime): Date {
  const d = new Date();
  d.setHours(t.hour, t.minute, 0, 0);
  return d;
}

function formatTime(t: DrugReminderTime): string {
  const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
  const ampm = t.hour < 12 ? 'am' : 'pm';
  return `${h12}:${t.minute.toString().padStart(2, '0')}${ampm}`;
}

export function AddDrugReminderSheet({ visible, submitting, error, initial, onSubmit, onDismiss }: Props) {
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState<DrugReminderTime[]>([]);
  const [pickerTime, setPickerTime] = useState<Date>(defaultTime());
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDrugName(initial?.drugName ?? '');
    setDosage(initial?.dosage ?? '');
    setTimes(initial?.times ?? []);
    setPickerTime(defaultTime());
    setPickerOpen(false);
  }, [visible, initial]);

  const addTime = (date: Date) => {
    const next = { hour: date.getHours(), minute: date.getMinutes() };
    setTimes((prev) =>
      prev.some((t) => t.hour === next.hour && t.minute === next.minute) ? prev : [...prev, next],
    );
  };

  const removeTime = (index: number) => setTimes((prev) => prev.filter((_, i) => i !== index));

  const canSubmit = drugName.trim().length > 0 && dosage.trim().length > 0 && times.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{initial ? 'Edit medicine reminder' : 'Add medicine reminder'}</Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Drug name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Amoxicillin"
              placeholderTextColor={colors.inputPlaceholder}
              value={drugName}
              onChangeText={setDrugName}
            />

            <Text style={styles.label}>Dosage</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2 tablets, or 1 teaspoon"
              placeholderTextColor={colors.inputPlaceholder}
              value={dosage}
              onChangeText={setDosage}
            />
            <Text style={styles.hint}>
              If your pharmacy said "two in the morning and two at night", enter "2 tablets" here and
              add both times below.
            </Text>

            <Text style={styles.label}>Times to take it</Text>
            {times.length > 0 ? (
              <View style={styles.chipsRow}>
                {times.map((t, index) => (
                  <View key={`${t.hour}:${t.minute}`} style={styles.chip}>
                    <Text style={styles.chipText}>{formatTime(t)}</Text>
                    <Pressable onPress={() => removeTime(index)} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={colors.darkAccentGreen} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {Platform.OS === 'android' ? (
              <Pressable style={styles.timeButton} onPress={() => setPickerOpen(true)}>
                <Ionicons name="add" size={16} color={colors.darkAccentGreen} />
                <Text style={styles.timeButtonText}>Add a time</Text>
              </Pressable>
            ) : (
              <View style={styles.iosPickerRow}>
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={pickerTime}
                    mode="time"
                    display="spinner"
                    onChange={(_event, selected) => {
                      if (selected) setPickerTime(selected);
                    }}
                  />
                </View>
                <Pressable style={styles.timeButton} onPress={() => addTime(pickerTime)}>
                  <Ionicons name="add" size={16} color={colors.darkAccentGreen} />
                  <Text style={styles.timeButtonText}>Add this time</Text>
                </Pressable>
              </View>
            )}

            {pickerOpen && Platform.OS === 'android' ? (
              <DateTimePicker
                value={pickerTime}
                mode="time"
                display="spinner"
                onChange={(_event, selected) => {
                  setPickerOpen(false);
                  if (selected) addTime(selected);
                }}
              />
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {submitting ? (
              <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
            ) : (
              <Pressable
                style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                disabled={!canSubmit}
                onPress={() => onSubmit(drugName.trim(), dosage.trim(), times)}
              >
                <Text style={styles.submitButtonText}>
                  {initial ? 'Save changes' : 'Set Reminder'}
                </Text>
              </Pressable>
            )}

            <Pressable style={styles.cancelButton} onPress={onDismiss}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  label: {
    fontFamily: fonts.headingMedium,
    fontSize: 13.5,
    color: colors.textPrimary,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  hint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: 5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.darkAccentGreen,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  timeButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.darkAccentGreen,
  },
  iosPickerRow: {
    alignItems: 'center',
  },
  pickerWrap: {
    alignItems: 'center',
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 12,
  },
  spinner: {
    height: 54,
    marginTop: 16,
  },
  submitButton: {
    backgroundColor: colors.primaryGreen,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
