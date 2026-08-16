import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  visible: boolean;
  dayLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (title: string, hour24: number, minute: number, notes: string) => void;
  onDismiss: () => void;
};

function defaultTime(): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function AddReminderSheet({ visible, dayLabel, submitting, error, onSubmit, onDismiss }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [time, setTime] = useState<Date>(defaultTime());
  // On Android the picker is a dialog we open on demand; on iOS it sits inline.
  const [pickerOpen, setPickerOpen] = useState(Platform.OS === 'ios');

  const reset = () => {
    setTitle('');
    setNotes('');
    setTime(defaultTime());
    setPickerOpen(Platform.OS === 'ios');
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

          <Text style={styles.timeLabel}>Time</Text>
          {Platform.OS === 'android' ? (
            <Pressable style={styles.timeButton} onPress={() => setPickerOpen(true)}>
              <Ionicons name="time-outline" size={18} color={colors.darkAccentGreen} />
              <Text style={styles.timeButtonText}>{formatTime(time)}</Text>
            </Pressable>
          ) : null}

          {pickerOpen ? (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={time}
                mode="time"
                display="spinner"
                onChange={(_event, selected) => {
                  if (Platform.OS === 'android') setPickerOpen(false);
                  if (selected) setTime(selected);
                }}
              />
            </View>
          ) : null}

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
                onSubmit(title.trim(), time.getHours(), time.getMinutes(), notes.trim());
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
  timeLabel: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  timeButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
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
