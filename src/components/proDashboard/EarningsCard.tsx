import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

type Props = {
  amount: string;
  growthLabel: string;
  tier: string;
};

export function EarningsCard({ amount, growthLabel, tier }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.leftColumn}>
        <Text style={styles.caption}>This Month's Earnings</Text>
        <Text style={styles.amount}>{amount}</Text>
        <View style={styles.growthRow}>
          <Ionicons name="arrow-up" size={13} color={colors.primaryGreen} />
          <Text style={styles.growthText}>{growthLabel}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.rightColumn}>
        <Text style={styles.caption}>Stipend Tier</Text>
        <View style={styles.tierRow}>
          <Text style={styles.tierText}>{tier}</Text>
          <MaterialCommunityIcons name="medal" size={26} color={GOLD} />
        </View>
      </View>
    </View>
  );
}

const GOLD = '#F5C41E';

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  leftColumn: {
    flex: 1.4,
  },
  caption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.cardDarkMutedText,
  },
  amount: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 26,
    color: colors.white,
    marginTop: 6,
  },
  growthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  growthText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.white,
    opacity: 0.9,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 16,
  },
  rightColumn: {
    flex: 1,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  tierText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: GOLD,
  },
});
