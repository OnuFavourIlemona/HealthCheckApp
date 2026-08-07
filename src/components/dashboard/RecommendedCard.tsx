import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tappable } from '../ui/Tappable';
import { colors, fonts } from '../../theme';

type Props = {
  title: string;
  subtitle: string;
  tag: string;
  tagTone?: 'good' | 'watch';
  icon?: ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
};

export function RecommendedCard({
  title,
  subtitle,
  tag,
  tagTone = 'good',
  icon = 'moon',
  onPress,
}: Props) {
  const good = tagTone === 'good';
  return (
    <Tappable style={styles.card} onPress={onPress}>
      <View style={[styles.iconCircle, !good && styles.iconCircleWatch]}>
        <Ionicons
          name={icon}
          size={20}
          color={good ? colors.darkAccentGreen : '#C77B00'}
        />
      </View>
      <View style={styles.textColumn}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={[styles.tag, !good && styles.tagWatch]}>
            <Text style={[styles.tagText, !good && styles.tagTextWatch]}>{tag}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleWatch: {
    backgroundColor: '#FFF4E0',
  },
  textColumn: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontFamily: fonts.headingMedium,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  tag: {
    backgroundColor: colors.pillGreenBg,
    borderRadius: 10,
    height: 20,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  tagWatch: {
    backgroundColor: '#FFF4E0',
  },
  tagText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.primaryGreen,
  },
  tagTextWatch: {
    color: '#C77B00',
  },
});
