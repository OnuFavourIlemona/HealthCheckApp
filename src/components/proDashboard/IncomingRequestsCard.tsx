import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Consultation } from '../../lib/consultations';
import { colors, fonts } from '../../theme';

type Props = {
  requests: Consultation[];
  acceptingId: string | null;
  error: string | null;
  onAccept: (id: string) => void;
};

function initialsOf(name: string | null): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const severityColor: Record<string, { bg: string; text: string }> = {
  mild: { bg: '#E5F5E8', text: '#0E8F2F' },
  moderate: { bg: '#FFF4E0', text: '#C77B00' },
  severe: { bg: '#FDE8E8', text: '#D64545' },
};

export function IncomingRequestsCard({ requests, acceptingId, error, onAccept }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Incoming Requests</Text>
          {requests.length > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{requests.length}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {requests.length === 0 ? (
        <Text style={styles.emptyText}>
          No pending requests right now. New patient requests appear here instantly.
        </Text>
      ) : (
        requests.map((request, index) => {
          const severity = request.severity ? severityColor[request.severity] : null;
          const accepting = acceptingId === request.id;
          return (
            <View key={request.id} style={[styles.requestRow, index > 0 && styles.requestDivider]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsOf(request.patient_name)}</Text>
              </View>
              <View style={styles.requestBody}>
                <Text style={styles.requestName}>{request.patient_name ?? 'Patient'}</Text>
                {request.patient_age ? (
                  <Text style={styles.requestDemographic}>
                    {request.patient_gender
                      ? `${request.patient_gender}, ${request.patient_age}`
                      : `Age ${request.patient_age}`}
                  </Text>
                ) : null}
                <Text style={styles.requestSymptoms} numberOfLines={3}>
                  <Text style={styles.requestSymptomsLabel}>Symptoms: </Text>
                  {request.symptoms ?? 'Not specified'}
                </Text>
                <View style={styles.pillRow}>
                  {request.duration ? (
                    <View style={styles.durationPill}>
                      <Text style={styles.durationPillText}>{request.duration}</Text>
                    </View>
                  ) : null}
                  {severity ? (
                    <View style={[styles.severityPill, { backgroundColor: severity.bg }]}>
                      <Text style={[styles.severityPillText, { color: severity.text }]}>
                        {request.severity}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.requestRight}>
                <Text style={styles.timeAgo}>{timeAgo(request.created_at)}</Text>
                <Pressable
                  style={[styles.acceptButton, accepting && styles.acceptButtonBusy]}
                  onPress={() => onAccept(request.id)}
                  disabled={accepting}
                >
                  {accepting ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.acceptText}>Accept</Text>
                  )}
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.pillGreenBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.white,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primaryGreen,
  },
  liveText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primaryGreen,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.danger,
    marginTop: 8,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 10,
    marginBottom: 10,
  },
  requestRow: {
    flexDirection: 'row',
    paddingVertical: 14,
  },
  requestDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.darkAccentGreen,
  },
  requestBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  requestName: {
    fontFamily: fonts.headingMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  requestDemographic: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  requestSymptoms: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  requestSymptomsLabel: {
    fontFamily: fonts.bodySemiBold,
    color: colors.textPrimary,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  durationPill: {
    backgroundColor: '#F1F1F1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  durationPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  severityPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  severityPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    textTransform: 'capitalize',
  },
  requestRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  timeAgo: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
  },
  acceptButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  acceptButtonBusy: {
    opacity: 0.7,
  },
  acceptText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.white,
  },
});
