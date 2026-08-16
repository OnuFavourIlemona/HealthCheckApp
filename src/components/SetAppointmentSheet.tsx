import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  visible: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (time: Date) => void;
  onDismiss: () => void;
};

function defaultTime(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function SetAppointmentSheet({ visible, submitting, error, onSubmit, onDismiss }: Props) {
  const [time, setTime] = useState<Date>(defaultTime());
  // On Android, DateTimePicker is a native dialog that must be mounted only
  // while it's meant to be open -- rendering both the date and time pickers
  // unconditionally (as this used to) fires two overlapping dialogs at once
  // with no way to close either, which is the "stuck" bug. iOS renders it
  // inline instead, so it can just stay mounted the whole time.
  const [androidStep, setAndroidStep] = useState<'closed' | 'date' | 'time'>('closed');

  useEffect(() => {
    if (visible) {
      setTime(defaultTime());
      setAndroidStep('closed');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Offer an appointment time</Text>
          <Text style={styles.subtitle}>
            Pick a time the patient can walk in. They will see it and can set their own reminder.
          </Text>

          {Platform.OS === 'android' ? (
            <View style={styles.androidRow}>
              <Pressable style={styles.dateButton} onPress={() => setAndroidStep('date')}>
                <Ionicons name="calendar-outline" size={16} color={colors.darkAccentGreen} />
                <Text style={styles.dateButtonText}>{formatDate(time)}</Text>
              </Pressable>
              <Pressable style={styles.dateButton} onPress={() => setAndroidStep('time')}>
                <Ionicons name="time-outline" size={16} color={colors.darkAccentGreen} />
                <Text style={styles.dateButtonText}>{formatTime(time)}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={time}
                mode="datetime"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_event, selected) => {
                  if (selected) setTime(selected);
                }}
              />
            </View>
          )}

          {Platform.OS === 'android' && androidStep === 'date' ? (
            <DateTimePicker
              value={time}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={(_event, selected) => {
                setAndroidStep('closed');
                if (selected) {
                  const merged = new Date(time);
                  merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                  setTime(merged);
                }
              }}
            />
          ) : null}

          {Platform.OS === 'android' && androidStep === 'time' ? (
            <DateTimePicker
              value={time}
              mode="time"
              display="default"
              onChange={(_event, selected) => {
                setAndroidStep('closed');
                if (selected) {
                  const merged = new Date(time);
                  merged.setHours(selected.getHours(), selected.getMinutes());
                  setTime(merged);
                }
              }}
            />
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {submitting ? (
            <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
          ) : (
            <Pressable style={styles.submitButton} onPress={() => onSubmit(time)}>
              <Text style={styles.submitButtonText}>Set Appointment</Text>
            </Pressable>
          )}

          <Pressable style={styles.cancelButton} onPress={onDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
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
    paddingTop: 10,
    paddingBottom: 28,
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
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  pickerWrap: {
    alignItems: 'center',
    marginTop: 14,
  },
  androidRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 13,
  },
  dateButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
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
