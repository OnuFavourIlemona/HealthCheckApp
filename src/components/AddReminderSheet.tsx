import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  visible: boolean;
  dayLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (title: string, hour12: number, minute: number, ampm: 'AM' | 'PM', notes: string) => void;
  onDismiss: () => void;
};

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function Stepper({
  value,
  onDecrease,
  onIncrease,
  formatValue,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  formatValue: (v: number) => string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepperButton} onPress={onDecrease} hitSlop={8}>
        <Ionicons name="chevron-down" size={18} color={colors.darkAccentGreen} />
      </Pressable>
      <Text style={styles.stepperValue}>{formatValue(value)}</Text>
      <Pressable style={styles.stepperButton} onPress={onIncrease} hitSlop={8}>
        <Ionicons name="chevron-up" size={18} color={colors.darkAccentGreen} />
      </Pressable>
    </View>
  );
}

export function AddReminderSheet({ visible, dayLabel, submitting, error, onSubmit, onDismiss }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [hour12, setHour12] = useState(9);
  const [minuteIndex, setMinuteIndex] = useState(0);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');

  const reset = () => {
    setTitle('');
    setNotes('');
    setHour12(9);
    setMinuteIndex(0);
    setAmpm('AM');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>New reminder</Text>
          <Text style={styles.subtitle}>{dayLabel}</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. Ward rounds, restock supplies..."
            placeholderTextColor={colors.inputPlaceholder}
            value={title}
            onChangeText={setTitle}
          />

          <View style={styles.timeRow}>
            <Stepper
              value={hour12}
              formatValue={(v) => String(v)}
              onDecrease={() => setHour12((h) => (h === 1 ? 12 : h - 1))}
              onIncrease={() => setHour12((h) => (h === 12 ? 1 : h + 1))}
            />
            <Text style={styles.timeColon}>:</Text>
            <Stepper
              value={MINUTE_STEPS[minuteIndex]}
              formatValue={(v) => String(v).padStart(2, '0')}
              onDecrease={() => setMinuteIndex((i) => (i === 0 ? MINUTE_STEPS.length - 1 : i - 1))}
              onIncrease={() => setMinuteIndex((i) => (i === MINUTE_STEPS.length - 1 ? 0 : i + 1))}
            />
            <View style={styles.ampmToggle}>
              <Pressable
                style={[styles.ampmButton, ampm === 'AM' && styles.ampmButtonActive]}
                onPress={() => setAmpm('AM')}
              >
                <Text style={[styles.ampmText, ampm === 'AM' && styles.ampmTextActive]}>AM</Text>
              </Pressable>
              <Pressable
                style={[styles.ampmButton, ampm === 'PM' && styles.ampmButtonActive]}
                onPress={() => setAmpm('PM')}
              >
                <Text style={[styles.ampmText, ampm === 'PM' && styles.ampmTextActive]}>PM</Text>
              </Pressable>
            </View>
          </View>

          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.inputPlaceholder}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            value={notes}
            onChangeText={setNotes}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {submitting ? (
            <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
          ) : (
            <Pressable
              style={[styles.submitButton, !title.trim() && styles.submitButtonDisabled]}
              disabled={!title.trim()}
              onPress={() => {
                onSubmit(title.trim(), hour12, MINUTE_STEPS[minuteIndex], ampm, notes.trim());
                reset();
              }}
            >
              <Text style={styles.submitButtonText}>Set Reminder</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.skipButton}
            onPress={() => {
              reset();
              onDismiss();
            }}
          >
            <Text style={styles.skipText}>Cancel</Text>
          </Pressable>
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
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
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
    marginTop: 16,
  },
  notesInput: {
    minHeight: 64,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  stepperButton: {
    padding: 2,
  },
  stepperValue: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
    marginVertical: 2,
    minWidth: 32,
    textAlign: 'center',
  },
  timeColon: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  ampmToggle: {
    marginLeft: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  ampmButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  ampmButtonActive: {
    backgroundColor: colors.primaryGreen,
  },
  ampmText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  ampmTextActive: {
    color: colors.white,
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
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  skipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
