import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  visible: boolean;
  title?: string;
  body?: string;
  onAllow: () => void;
  onDismiss: () => void;
};

/**
 * A friendly pre-permission prompt shown before the system notification dialog,
 * the way modern apps ask. The OS dialog only appears once, so we explain the
 * value first and let the OS ask when the user taps Allow.
 */
export function NotificationPrimer({ visible, title, body, onAllow, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="notifications" size={28} color={colors.white} />
          </View>
          <Text style={styles.title}>{title ?? 'Turn on notifications'}</Text>
          <Text style={styles.body}>
            {body ??
              'Allow notifications so we can remind you on time, even when the app is closed. You can turn this off any time.'}
          </Text>
          <Pressable style={styles.allowButton} onPress={onAllow}>
            <Text style={styles.allowText}>Allow notifications</Text>
          </Pressable>
          <Pressable style={styles.laterButton} onPress={onDismiss} hitSlop={8}>
            <Text style={styles.laterText}>Not now</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  allowButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.primaryGreen,
    borderRadius: 26,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  allowText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
  laterButton: {
    marginTop: 14,
    paddingVertical: 4,
  },
  laterText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
