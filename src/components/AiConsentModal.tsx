import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  visible: boolean;
  /** Read-only mode: user already consented and is just re-reading. */
  readOnly?: boolean;
  onAgree: () => void;
  onClose: () => void;
};

const points: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; body: string }[] = [
  {
    icon: 'brain',
    title: 'How predictions work',
    body: 'Our model estimates your risk of conditions like diabetes, hypertension and stroke, using health information you provide such as your age, BMI, sleep, lifestyle and medical history.',
  },
  {
    icon: 'database-lock',
    title: 'Your data, protected',
    body: 'Your health information is stored securely, is only used to generate your predictions, and is never shared without your permission. You can update or correct it at any time.',
  },
  {
    icon: 'target',
    title: 'Accuracy depends on you',
    body: 'Predictions are only as good as the information behind them. Please enter honest, up-to-date values, since inaccurate data leads to inaccurate results.',
  },
  {
    icon: 'stethoscope',
    title: 'Not a medical diagnosis',
    body: 'HealthCheck is a screening and awareness tool, not a medical device. Predictions do not replace professional medical advice, diagnosis or treatment. Always consult a qualified health professional about your health.',
  },
];

export function AiConsentModal({ visible, readOnly = false, onAgree, onClose }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="shield-check" size={22} color={colors.darkAccentGreen} />
            </View>
            <Text style={styles.title}>About Your AI Predictions</Text>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {points.map((point) => (
              <View key={point.title} style={styles.pointRow}>
                <View style={styles.pointIcon}>
                  <MaterialCommunityIcons name={point.icon} size={18} color={colors.darkAccentGreen} />
                </View>
                <View style={styles.pointText}>
                  <Text style={styles.pointTitle}>{point.title}</Text>
                  <Text style={styles.pointBody}>{point.body}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.emergency}>
              In case of an emergency, call 112 or visit the nearest hospital immediately.
            </Text>
          </ScrollView>

          {readOnly ? (
            <Pressable style={styles.agreeButton} onPress={onClose}>
              <Text style={styles.agreeButtonText}>Got it</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.checkboxRow} onPress={() => setChecked((c) => !c)}>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
                </View>
                <Text style={styles.checkboxLabel}>
                  I have read and understood how AI predictions work and that they are not a
                  medical diagnosis.
                </Text>
              </Pressable>
              <Pressable
                style={[styles.agreeButton, !checked && styles.agreeButtonDisabled]}
                disabled={!checked}
                onPress={onAgree}
              >
                <Text style={styles.agreeButtonText}>Agree & Continue</Text>
              </Pressable>
            </>
          )}
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
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  body: {
    flexGrow: 0,
  },
  pointRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  pointIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pointText: {
    flex: 1,
  },
  pointTitle: {
    fontFamily: fonts.headingMedium,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  pointBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 3,
  },
  emergency: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  agreeButton: {
    backgroundColor: colors.primaryGreen,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  agreeButtonDisabled: {
    opacity: 0.4,
  },
  agreeButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
});
