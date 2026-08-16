import { StyleSheet, Text, View } from 'react-native';
import { Tappable } from '../ui/Tappable';
import { useCountUp } from '../../lib/useCountUp';
import { colors, fonts, riskLevelColor, type RiskLevel } from '../../theme';

type Props = {
  label: string;
  score: number;
  level: RiskLevel;
  onPress?: () => void;
};

const levelText: Record<RiskLevel, string> = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
};

export function RiskScoreCard({ label, score, level, onPress }: Props) {
  const color = riskLevelColor(level);
  const animatedScore = useCountUp(score);

  return (
    <Tappable style={styles.card} onPress={onPress} scaleDown={!!onPress}>
      <View style={[styles.accentBar, { backgroundColor: color }]} />
      <Text style={[styles.status, { color }]}>{levelText[level]}</Text>
      <Text style={styles.score}>{Math.round(animatedScore)}</Text>
      <Text style={styles.label}>{label}</Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 166,
    height: 108,
    // Green brand tint (the risk level still shows through the accent bar and
    // status word, so High/Moderate stay clearly flagged).
    backgroundColor: colors.pillGreenBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.pillGreenBorder,
    paddingHorizontal: 16,
    paddingTop: 16,
    overflow: 'hidden',
    shadowColor: '#0E8F2F',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
  },
  status: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
  },
  score: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 24,
    color: colors.textPrimary,
    marginTop: 4,
  },
  label: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
