import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

type Props = {
  label: string;
  value: string;
  valueSuffix?: string;
  valueEmoji?: string;
  /** Caption under the value. Plain text unless `trendUp` is set. */
  trendLabel?: string;
  /** Show the green up-arrow — only when the caption is a real upward trend. */
  trendUp?: boolean;
  trendEmoji?: string;
  /** Green-tinted background, used on alternating tiles so the row isn't all white. */
  tinted?: boolean;
  /** Fill the parent's width instead of the fixed 132 (used in the 2x2 grid). */
  fill?: boolean;
};

export function StatTile({
  label,
  value,
  valueSuffix,
  valueEmoji,
  trendLabel,
  trendUp = false,
  trendEmoji,
  tinted = false,
  fill = false,
}: Props) {
  return (
    <View style={[styles.card, tinted && styles.cardTinted, fill && styles.cardFill]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, tinted && styles.valueTinted]}>{value}</Text>
        {valueSuffix ? <Text style={styles.valueSuffix}> {valueSuffix}</Text> : null}
        {valueEmoji ? <Text style={styles.valueEmoji}> {valueEmoji}</Text> : null}
      </View>
      {trendLabel ? (
        <View style={styles.trendRow}>
          {trendUp ? <Ionicons name="arrow-up" size={12} color={colors.primaryGreen} /> : null}
          <Text style={[styles.trendText, !trendUp && styles.captionText]} numberOfLines={1}>
            {trendLabel}
          </Text>
        </View>
      ) : trendEmoji ? (
        <Text style={styles.trendEmoji}>{trendEmoji}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 132,
    minHeight: 92,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTinted: {
    backgroundColor: colors.pillGreenBg,
  },
  cardFill: {
    width: '100%',
  },
  valueTinted: {
    color: colors.darkAccentGreen,
  },
  label: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  value: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: colors.textPrimary,
  },
  valueSuffix: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  valueEmoji: {
    fontSize: 16,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  trendText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primaryGreen,
  },
  captionText: {
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
  },
  trendEmoji: {
    fontSize: 14,
    marginTop: 6,
  },
});
