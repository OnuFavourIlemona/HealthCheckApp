import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Animated, Pressable, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Set false for large surfaces (full-width cards) where a strong scale reads as sluggish. */
  scaleDown?: boolean;
};

/**
 * Standard tactile press wrapper used across the app: a light haptic tick
 * plus a subtle spring scale-down, so every card/row feels consistently
 * "alive" under touch instead of the plain opacity Pressable gives by default.
 */
export function Tappable({ children, onPress, style, disabled, scaleDown = true }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        if (scaleDown) animateTo(0.97);
      }}
      onPressOut={() => animateTo(1)}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
