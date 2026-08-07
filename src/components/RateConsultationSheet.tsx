import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  visible: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (rating: number, comment: string) => void;
  onDismiss: () => void;
};

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export function RateConsultationSheet({ visible, submitting, error, onSubmit, onDismiss }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>How was your consultation?</Text>
          <Text style={styles.subtitle}>
            Your feedback helps other patients find good practitioners.
          </Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable key={value} onPress={() => setRating(value)} hitSlop={6}>
                <Ionicons
                  name={value <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={value <= rating ? '#F5C41E' : colors.border}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingLabel}>{rating > 0 ? LABELS[rating] : 'Tap to rate'}</Text>

          <TextInput
            style={styles.input}
            placeholder="Add a comment (optional)"
            placeholderTextColor={colors.inputPlaceholder}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={comment}
            onChangeText={setComment}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {submitting ? (
            <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
          ) : (
            <Pressable
              style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
              disabled={rating === 0}
              onPress={() => onSubmit(rating, comment)}
            >
              <Text style={styles.submitButtonText}>Submit Rating</Text>
            </Pressable>
          )}

          <Pressable style={styles.skipButton} onPress={onDismiss}>
            <Text style={styles.skipText}>Maybe later</Text>
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
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  ratingLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.darkAccentGreen,
    textAlign: 'center',
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 16,
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
