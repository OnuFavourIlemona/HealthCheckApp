import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Avatar } from './ui/Avatar';

type InfoRow = { label: string; value: string };

type Props = {
  visible: boolean;
  name: string;
  avatarUrl?: string | null;
  verified: boolean;
  rows: InfoRow[];
  onDismiss: () => void;
};

/** Shown when tapping the other party's avatar in a ProConnect chat -- a quick-glance card, not a full profile. */
export function PersonInfoSheet({ visible, name, avatarUrl, verified, rows, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Avatar name={name} avatarUrl={avatarUrl} size={64} />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            {verified ? (
              <MaterialCommunityIcons name="check-decagram" size={17} color={colors.primaryGreen} />
            ) : null}
          </View>

          {rows.length > 0 ? (
            <View style={styles.rowsBlock}>
              {rows.map((row, index) => (
                <View key={row.label} style={[styles.row, index > 0 && styles.rowSpacing]}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No further details shared yet.</Text>
          )}

          <Pressable style={styles.closeButton} onPress={onDismiss}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  rowsBlock: {
    alignSelf: 'stretch',
    marginTop: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowSpacing: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  rowValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
});
