import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  /** Position in a list — used to compute the stagger delay. */
  index?: number;
  /** Delay between each item in a staggered list, in ms. */
  staggerMs?: number;
  style?: ViewStyle;
};

/**
 * Fades and slides content up on mount. Pass `index` when rendering a list so
 * each item's entrance is staggered slightly after the previous one.
 */
export function FadeInUp({ children, index = 0, staggerMs = 45, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 380,
      delay: index * staggerMs,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
