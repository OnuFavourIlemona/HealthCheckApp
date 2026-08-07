import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

type Props = {
  label: string;
  icon: ReactNode;
  onPress?: () => void;
};

export function QuickActionButton({ label, icon, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.iconWell}>{icon}</View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 80,
    alignItems: 'center',
  },
  cardPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0E8F2F',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 8,
  },
});
