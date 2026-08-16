import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Animates a number from 0 up to `target` once on mount (and whenever the
 * target changes), so scores and stats tick up instead of snapping in.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const anim = new Animated.Value(0);
    const listenerId = anim.addListener(({ value: v }) => setValue(v));
    Animated.timing(anim, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(listenerId);
  }, [target, duration]);

  return value;
}
