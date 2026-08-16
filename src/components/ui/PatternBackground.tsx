import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '../../theme';

type Props = {
  /** Height of the decorative area. Defaults to filling the whole screen — a sibling of the ScrollView, not a child, so it stays fixed behind content as it scrolls rather than scrolling away with it. */
  height?: number | '100%';
  /** How many copies to stack vertically to cover that height. Defaults to 3 for a full screen (matching the Figma design) or scaled down for a shorter, explicit height — so a short hero area doesn't get its tiles squashed into thin slivers. */
  tileCount?: number;
  style?: ViewStyle;
};

/** ~each source tile looks right at around this height before it starts visibly cropping. */
const NATURAL_TILE_HEIGHT = 350;

function defaultTileCount(height: number | '100%'): number {
  if (height === '100%') return 3;
  return Math.max(1, Math.round(height / NATURAL_TILE_HEIGHT));
}

/**
 * The faint bed/syringe/pill watermark from the Figma design — already used
 * (pre-composed into the exported PNGs) on Splash and the onboarding
 * carousel, but never applied to the screens built from scratch since
 * (SelectRole, Login, SignupForm, CheckEmail).
 *
 * Stacks copies of the source image in a column rather than stretching one
 * copy to fill the whole height (which blows the icons up past their
 * natural size). Two things keep it from reading as an obviously-repeated
 * block: alternate tiles are horizontally mirrored, so the diagonal icons
 * alternate direction instead of marching the same way every row, and a
 * soft gradient dissolves the last third into the page's white so it never
 * ends on a hard edge.
 */
export function PatternBackground({ height = '100%', tileCount, style }: Props) {
  const tiles = tileCount ?? defaultTileCount(height);
  return (
    <View style={[styles.container, { height }, style]} pointerEvents="none">
      {Array.from({ length: tiles }).map((_, index) => (
        <Image
          key={index}
          source={require('../../../assets/images/onboarding/pattern-bg.png')}
          style={[styles.tile, index % 2 === 1 && styles.tileMirrored]}
          resizeMode="cover"
        />
      ))}
      <LinearGradient
        colors={['transparent', 'transparent', colors.white]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  tile: {
    width: '100%',
    flex: 1,
    opacity: 0.55,
  },
  tileMirrored: {
    transform: [{ scaleX: -1 }],
  },
});
