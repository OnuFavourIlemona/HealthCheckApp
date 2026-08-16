import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../components/ui/BounceIn';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { SkeletonList } from '../components/ui/Skeleton';
import { Tappable } from '../components/ui/Tappable';
import {
  fetchNotifications,
  markAllAsRead,
  markAsRead,
  notificationNavigateArgs,
  subscribeToNotifications,
  timeAgo,
  type AppNotification,
} from '../lib/notifications';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

type IconSpec = {
  name: ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  bg: string;
};

const TYPE_ICONS: Record<string, IconSpec> = {
  consultation_request: { name: 'account-clock', color: '#C77B00', bg: '#FFF4E0' },
  consultation_accepted: { name: 'check-decagram', color: '#0E8F2F', bg: '#E5F5E8' },
  consultation_completed: { name: 'clipboard-check-outline', color: '#6B7280', bg: '#EFEFEF' },
  message: { name: 'message-text-outline', color: '#0E8F2F', bg: '#E5F5E8' },
  lab_booking: { name: 'test-tube', color: '#6C6FCF', bg: '#E6E8FA' },
  rating: { name: 'star-outline', color: '#C77B00', bg: '#FFF4E0' },
};

const FALLBACK_ICON: IconSpec = {
  name: 'bell-outline',
  color: '#0E8F2F',
  bg: '#E5F5E8',
};

export function NotificationsScreen({ navigation }: Props) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setItems(await fetchNotifications());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // New notifications arrive without needing a refresh.
  useEffect(() => subscribeToNotifications(load), [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const unreadCount = items.filter((item) => item.read_at == null).length;

  const handleOpen = async (item: AppNotification) => {
    if (item.read_at == null) {
      // Optimistic: the row updates in the background.
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      markAsRead(item.id);
    }

    const args = notificationNavigateArgs(item.data);
    if (args) (navigation.navigate as (...a: unknown[]) => void)(args[0], args[1]);
  };

  const handleMarkAll = async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await markAllAsRead();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={handleMarkAll} hitSlop={8}>
            <Text style={styles.markAll}>Mark all</Text>
          </Pressable>
        ) : (
          <View style={{ width: 52 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.content}>
          <SkeletonList count={5} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <BounceIn style={styles.emptyIcon}>
            <Ionicons name="notifications-outline" size={34} color={colors.primaryGreen} />
          </BounceIn>
          <Text style={styles.emptyTitle}>You're all caught up</Text>
          <Text style={styles.emptyBody}>
            Updates about your consultations, messages and bookings will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryGreen}
              colors={[colors.primaryGreen]}
            />
          }
        >
          {items.map((item, index) => {
            const icon = TYPE_ICONS[item.type] ?? FALLBACK_ICON;
            const unread = item.read_at == null;
            return (
              <FadeInUp key={item.id} index={index}>
                <Tappable
                  style={[styles.card, unread && styles.cardUnread]}
                  onPress={() => handleOpen(item)}
                >
                  <View style={[styles.icon, { backgroundColor: icon.bg }]}>
                    <MaterialCommunityIcons name={icon.name} size={20} color={icon.color} />
                  </View>
                  <View style={styles.body}>
                    <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.body ? (
                      <Text style={styles.message} numberOfLines={2}>
                        {item.body}
                      </Text>
                    ) : null}
                    <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                  </View>
                  {unread ? <View style={styles.unreadDot} /> : null}
                </Tappable>
              </FadeInUp>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  markAll: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.primaryGreen,
    width: 52,
    textAlign: 'right',
  },
  loader: {
    marginTop: 60,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptyBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardUnread: {
    backgroundColor: '#F3FBF5',
    borderWidth: 1,
    borderColor: colors.pillGreenBg,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontFamily: fonts.headingMedium,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  titleUnread: {
    fontFamily: fonts.headingSemiBold,
  },
  message: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  time: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primaryGreen,
  },
});
