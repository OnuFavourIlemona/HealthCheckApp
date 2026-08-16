import { supabase } from './supabase';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: { screen?: string; consultationId?: string; bookingId?: string; reservationId?: string } | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AppNotification[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  return count ?? 0;
}

export async function markAsRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
}

export async function markAllAsRead(): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
}

export async function deleteNotification(id: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', id);
}

/**
 * Live feed — fires on any change to the signed-in user's notifications.
 *
 * The channel name must be unique per subscriber: Supabase reuses a channel
 * with the same topic, and adding a postgres_changes listener to one that has
 * already called subscribe() throws. Several screens subscribe at once (both
 * dashboards and this screen), so each gets its own channel.
 */
let notificationChannelSeq = 0;

export function subscribeToNotifications(onChange: () => void): () => void {
  notificationChannelSeq += 1;
  const channel = supabase
    .channel(`notifications:self:${notificationChannelSeq}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Turns a notification's `data` payload into a `navigation.navigate(...)`
 * call. Shared by the in-app Notifications list and the OS push-tap handler
 * in App.tsx, so both routes always agree on where a notification goes --
 * this used to only live in the Notifications screen, so tapping a push
 * notification from the OS tray (app closed or backgrounded) fell back to a
 * bare `navigate(screen)` with no params and always landed on a tab
 * navigator's default tab instead of the right one.
 */
export function notificationNavigateArgs(
  data: AppNotification['data'],
): [string, Record<string, unknown> | undefined] | null {
  if (!data?.screen) return null;
  const { screen, consultationId, bookingId, reservationId } = data;

  if (screen === 'ProConnect' && consultationId) {
    return ['ProConnect', { consultationId }];
  }
  if (screen === 'ProTabs') {
    return ['ProTabs', undefined];
  }
  if (screen === 'PharmacyTabs') {
    // Every notification that points here is either about a lab booking or a
    // medicine hold, so land on the Bookings tab's matching section with the
    // item highlighted, rather than the tab navigator's default (Dashboard).
    return [
      'PharmacyTabs',
      {
        screen: 'Bookings',
        params: reservationId
          ? { reservationId, section: 'holds' }
          : { bookingId, section: 'labs' },
      },
    ];
  }
  if (screen === 'MyLabBookings') {
    return ['MyLabBookings', { bookingId }];
  }
  if (screen === 'MyMedicineHolds') {
    return ['MyMedicineHolds', { reservationId }];
  }
  return [screen, undefined];
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
