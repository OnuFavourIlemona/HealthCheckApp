import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts, riskLevelColor, type RiskLevel } from '../../theme';

export type RiskSlide = {
  key: string;
  label: string;
  /** Null when this condition has not been assessed yet. */
  score: number | null;
  level: RiskLevel | null;
};

type Props = {
  slides: RiskSlide[];
  /** Shown in the header, e.g. "Low" or "Not assessed". */
  overallLabel: string;
  onPressSlide?: (slide: RiskSlide) => void;
};

const AUTO_ADVANCE_MS = 4000;
const CARD_MARGIN = 24;
const RING_SIZE = 92;
const STROKE = 8;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Circular gauge that animates from empty to the score. */
function AnimatedRing({ score, color }: { score: number; color: string }) {
  const radius = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: Math.min(Math.max(score, 0), 100) / 100,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      // strokeDashoffset is not supported by the native driver.
      useNativeDriver: false,
    }).start();
  }, [score, progress]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={radius}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={STROKE}
        fill="none"
      />
      <AnimatedCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={radius}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
    </Svg>
  );
}

function levelText(level: RiskLevel | null): string {
  if (level === 'LOW') return 'Low risk';
  if (level === 'MODERATE') return 'Moderate risk';
  if (level === 'HIGH') return 'High risk';
  return 'Not assessed';
}

export function HealthRiskSummaryCard({ slides, overallLabel, onPressSlide }: Props) {
  const { width } = useWindowDimensions();
  const slideWidth = width - CARD_MARGIN * 2;
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const interacting = useRef(false);

  // Auto-advance, pausing while the user is swiping.
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      if (interacting.current) return;
      setIndex((current) => {
        const next = (current + 1) % slides.length;
        scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length, slideWidth]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Health Risk Summary</Text>
        <Text style={styles.overall}>{overallLabel}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          interacting.current = true;
        }}
        onMomentumScrollEnd={(event) => {
          interacting.current = false;
          setIndex(Math.round(event.nativeEvent.contentOffset.x / slideWidth));
        }}
        style={styles.slider}
      >
        {slides.map((slide) => {
          const color = slide.level ? riskLevelColor(slide.level) : 'rgba(255,255,255,0.5)';
          return (
            <Pressable
              key={slide.key}
              style={[styles.slide, { width: slideWidth }]}
              onPress={() => onPressSlide?.(slide)}
            >
              <View style={styles.ringWrap}>
                <AnimatedRing score={slide.score ?? 0} color={color} />
                <View style={styles.ringLabel}>
                  {slide.score != null ? (
                    <>
                      <Text style={styles.ringScore}>{Math.round(slide.score)}</Text>
                      <Text style={styles.ringOutOf}>/100</Text>
                    </>
                  ) : (
                    <Text style={styles.ringDash}>—</Text>
                  )}
                </View>
              </View>

              <View style={styles.slideText}>
                <Text style={styles.slideLabel}>{slide.label}</Text>
                <Text style={[styles.slideLevel, slide.level ? { color } : styles.slideLevelMuted]}>
                  {levelText(slide.level)}
                </Text>
                <Text style={styles.slideHint}>
                  {slide.score != null ? 'Tap to see what drives this' : 'Run an assessment to see this'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {slides.map((slide, i) => (
          <View key={slide.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardDark,
    borderRadius: 20,
    paddingTop: 18,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.white,
  },
  // Deliberately small: this is a caption, not a headline.
  overall: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.cardDarkMutedText,
  },
  slider: {
    marginTop: 14,
  },
  slide: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ringScore: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 26,
    color: colors.white,
  },
  ringOutOf: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.cardDarkMutedText,
  },
  ringDash: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 26,
    color: colors.cardDarkMutedText,
  },
  slideText: {
    flex: 1,
    marginLeft: 18,
  },
  slideLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.white,
  },
  slideLevel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    marginTop: 4,
  },
  slideLevelMuted: {
    color: colors.cardDarkMutedText,
  },
  slideHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.cardDarkMutedText,
    marginTop: 6,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.white,
  },
});
