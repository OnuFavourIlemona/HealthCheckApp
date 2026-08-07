import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../../theme';

type Props = {
  label?: string;
  onPress?: () => void;
};

export function ProceedButton({ label = 'Proceed', onPress }: Props) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Real dimensions from Figma inspector: 345 x 64, corner radius 999.
  // Fill kept as the founder's brand primaryGreen, not Figma's raw #119715.
  button: {
    backgroundColor: colors.primaryGreen,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.white,
  },
});
