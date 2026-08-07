import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { colors, fonts } from '../../theme';

type Props = {
  /** Consultations per day for the last 14 days, oldest first. */
  dailyCounts: number[];
  /** Ratings in chronological order (1-5). */
  ratingTrend: number[];
  totalConsultations: number;
  averageRating: number | null;
};

function BarChart({ values, width, height }: { values: number[]; width: number; height: number }) {
  const gap = 4;
  const barWidth = (width - gap * (values.length - 1)) / values.length;
  const max = Math.max(...values, 1);
  return (
    <Svg width={width} height={height}>
      {values.map((value, i) => {
        const barHeight = value === 0 ? 2 : (value / max) * height;
        const isToday = i === values.length - 1;
        return (
          <Rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={2}
            fill={isToday ? '#F5C41E' : colors.primaryGreen}
            opacity={value === 0 ? 0.25 : isToday ? 1 : 0.75}
          />
        );
      })}
    </Svg>
  );
}

function LineChart({ values, width, height }: { values: number[]; width: number; height: number }) {
  const min = 1;
  const max = 5;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, i) => ({
    x: values.length === 1 ? width / 2 : i * stepX,
    y: height - ((value - min) / (max - min)) * height,
  }));
  return (
    <Svg width={width} height={height}>
      {points.length > 1 ? (
        <Polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={colors.primaryGreen}
          strokeWidth={2}
        />
      ) : null}
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill={colors.white}
          stroke={colors.primaryGreen}
          strokeWidth={2}
        />
      ))}
    </Svg>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyChartText}>{label}</Text>
    </View>
  );
}

export function PerformanceOverview({
  dailyCounts,
  ratingTrend,
  totalConsultations,
  averageRating,
}: Props) {
  const hasConsultations = dailyCounts.some((count) => count > 0);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Performance Overview</Text>
        <Text style={styles.periodText}>Last 14 days</Text>
      </View>
      <View style={styles.chartsRow}>
        <View style={styles.chartCard}>
          <Text style={styles.chartLabel}>Consultations</Text>
          <Text style={styles.chartValue}>{totalConsultations}</Text>
          <View style={styles.chartArea}>
            {hasConsultations ? (
              <BarChart values={dailyCounts} width={130} height={64} />
            ) : (
              <EmptyChart label="No activity yet" />
            )}
          </View>
        </View>
        <View style={styles.chartCard}>
          <Text style={styles.chartLabel}>Ratings</Text>
          <Text style={styles.chartValue}>
            {averageRating != null ? averageRating.toFixed(1) : '—'}
            {averageRating != null ? <Text style={styles.chartValueSuffix}>/5</Text> : null}
          </Text>
          <View style={styles.chartArea}>
            {ratingTrend.length > 0 ? (
              <LineChart values={ratingTrend} width={130} height={64} />
            ) : (
              <EmptyChart label="No ratings yet" />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  periodText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chartsRow: {
    flexDirection: 'row',
    gap: 13,
    marginTop: 14,
  },
  chartCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  chartLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chartValue: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: colors.textPrimary,
    marginTop: 4,
  },
  chartValueSuffix: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chartArea: {
    marginTop: 10,
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
  },
  emptyChart: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
  },
});
