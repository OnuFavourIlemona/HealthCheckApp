import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export type TabIconMap = Record<string, { active: IconName; inactive: IconName }>;

/**
 * Custom bottom tab bar with a pill that slides beneath the active icon,
 * instead of a flat color swap. Shared shape used by all three role tab bars.
 */
export function AnimatedTabBar({ state, descriptors, navigation, tabIcons }: BottomTabBarProps & { tabIcons: TabIconMap }) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;
  const tabWidth = state.routes.length > 0 ? barWidth / state.routes.length : 0;

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom, height: 60 + insets.bottom }]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      {barWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              width: tabWidth - 24,
              transform: [
                {
                  translateX: pillX.interpolate({
                    inputRange: [0, Math.max(state.routes.length - 1, 1)],
                    outputRange: [12, 12 + tabWidth * Math.max(state.routes.length - 1, 1)],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const icons = tabIcons[route.name];
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : (options.title ?? route.name);

        const onPress = () => {
          Haptics.selectionAsync().catch(() => {});
          Animated.spring(pillX, {
            toValue: index,
            useNativeDriver: true,
            speed: 22,
            bounciness: 6,
          }).start();

          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable key={route.key} style={styles.tab} onPress={onPress}>
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={24}
              color={focused ? colors.tabActive : colors.tabInactive}
            />
            <Text style={[styles.label, { color: focused ? colors.tabActive : colors.tabInactive }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  pill: {
    position: 'absolute',
    top: 2,
    left: 0,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.pillGreenBg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
  },
});
