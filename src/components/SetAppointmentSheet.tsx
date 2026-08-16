import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
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

export function SetAppointmentSheet({ visible, submitting, error, onSubmit, onDismiss }: Props) {
  const [time, setTime] = useState<Date>(defaultTime());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Offer an appointment time</Text>
          <Text style={styles.subtitle}>
            Pick a time the patient can walk in. They will see it and can set their own reminder.
          </Text>

          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={time}
              mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(_event, selected) => {
                if (selected) setTime(selected);
              }}
            />
          </View>

          {Platform.OS === 'android' ? (
            <DateTimePicker
              value={time}
              mode="time"
              display="default"
              onChange={(_event, selected) => {
                if (selected) {
                  const combined = new Date(time);
                  combined.setHours(selected.getHours(), selected.getMinutes());
                  setTime(combined);
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
