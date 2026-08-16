import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../components/ui/BounceIn';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { SkeletonList } from '../components/ui/Skeleton';
import {
  fetchAssessmentHistory,
  labelForAssessment,
  latestPerType,
  normaliseLevel,
  type RiskAssessment,
} from '../lib/dashboard';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, riskLevelColor } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RiskHistory'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function levelLabel(level: string): string {
  const normalised = normaliseLevel(level);
  return normalised === 'LOW' ? 'Low' : normalised === 'MODERATE' ? 'Moderate' : 'High';
}

export function RiskHistoryScreen({ navigation }: Props) {
  const [history, setHistory] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const data = await fetchAssessmentHistory();
      setHistory(data);
      setLoading(false);
    })();
  }, []);

  // One card per condition (the latest), so the list isn't cluttered with repeats.
  const latest = latestPerType(history);
  const types = Array.from(new Set(latest.map((h) => h.assessment_type)));
  const visible = filter ? latest.filter((h) => h.assessment_type === filter) : latest;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Assessment History</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.content}>
          <SkeletonList count={5} />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyState}>
          <BounceIn style={styles.emptyIcon}>
            <Ionicons name="documents-outline" size={32} color={colors.primaryGreen} />
          </BounceIn>
          <Text style={styles.emptyTitle}>No assessments yet</Text>
          <Text style={styles.emptyBody}>
            Your past risk assessments will appear here once you run one.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Pressable
              style={[styles.filterChip, filter === null && styles.filterChipActive]}
              onPress={() => setFilter(null)}
            >
              <Text style={[styles.filterText, filter === null && styles.filterTextActive]}>
                All
              </Text>
            </Pressable>
            {types.map((type) => (
              <Pressable
                key={type}
                style={[styles.filterChip, filter === type && styles.filterChipActive]}
                onPress={() => setFilter(type)}
              >
                <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
                  {labelForAssessment(type)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {visible.map((item, index) => {
            const level = normaliseLevel(item.risk_level);
            const color = riskLevelColor(level);
            return (
              <FadeInUp key={item.id} index={index}>
                <Pressable
                  style={styles.card}
                  onPress={() =>
                    navigation.navigate('RiskPrediction', { assessmentType: item.assessment_type })
                  }
                >
                  <View style={[styles.scoreCircle, { borderColor: color }]}>
                    <Text style={[styles.scoreValue, { color }]}>{Math.round(item.score)}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>
                      {labelForAssessment(item.assessment_type)}
                    </Text>
                    <Text style={[styles.cardLevel, { color }]}>
                      {levelLabel(item.risk_level)} risk
                    </Text>
                    <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              </FadeInUp>
            );
          })}

          <Text style={styles.disclaimer}>
            Scores are screening estimates based on the information you provided. They are not a
            medical diagnosis.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  loader: {
    marginTop: 60,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 24,
  },
  filterChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  filterText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.white,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  scoreCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
  },
  cardBody: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontFamily: fonts.headingMedium,
    fontSize: 15.5,
    color: colors.textPrimary,
  },
  cardLevel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    marginTop: 2,
  },
  cardDate: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 3,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptyBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  disclaimer: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 22,
  },
});
