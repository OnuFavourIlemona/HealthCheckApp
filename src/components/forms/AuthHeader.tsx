import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

type Props = {
  onBack?: () => void;
};

export function AuthHeader({ onBack }: Props) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <Image
        source={require('../../../assets/images/dashboard/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.backButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // Real dimensions from Figma inspector: 173 x 40 (smaller than the 208x48
  // logo used on Select Role — this screen's logo is scaled down).
  logo: {
    width: 173,
    height: 40,
  },
});
