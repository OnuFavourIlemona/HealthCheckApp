import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { Avatar } from '../ui/Avatar';

type Props = {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  role: string;
  /** Only verified practitioners get the badge — it must mean something. */
  verified?: boolean;
  notificationCount?: number;
  onPressNotifications?: () => void;
  onPressAvatar?: () => void;
};

function greetingForNow(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function ProDashboardHeader({
  name,
  email,
  avatarUrl,
  role,
  verified = false,
  notificationCount = 0,
  onPressNotifications,
  onPressAvatar,
}: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPressAvatar}>
        <Avatar
          email={email}
          name={name.replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, '')}
          avatarUrl={avatarUrl}
          size={48}
        />
      </Pressable>
      <View style={styles.textColumn}>
        <View style={styles.nameRow}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greetingForNow()}, {name}
          </Text>
          {verified ? (
            <MaterialIcons name="verified" size={18} color={colors.primaryGreen} />
          ) : null}
        </View>
        <Text style={styles.role}>{role}</Text>
      </View>
      <Pressable style={styles.bellButton} onPress={onPressNotifications}>
        <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
        {notificationCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {notificationCount > 99 ? '99+' : notificationCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textColumn: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greeting: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  role: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.white,
  },
});
