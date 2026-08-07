import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';
import { Avatar } from '../ui/Avatar';
import { Tappable } from '../ui/Tappable';

type Props = {
  email?: string | null;
  name?: string | null;
  notificationCount?: number;
  onPressNotifications?: () => void;
  onPressAvatar?: () => void;
};

export function DashboardHeader({
  email,
  name,
  notificationCount = 0,
  onPressNotifications,
  onPressAvatar,
}: Props) {
  return (
    <View style={styles.row}>
      <Image
        source={require('../../../assets/images/dashboard/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.iconsRow}>
        <Pressable style={styles.iconButton} onPress={onPressNotifications}>
          <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
          {notificationCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notificationCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Tappable onPress={onPressAvatar} scaleDown={false}>
          <Avatar email={email} name={name} size={32} />
        </Tappable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  logo: {
    width: 140,
    height: 32,
  },
  iconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.white,
  },
});
