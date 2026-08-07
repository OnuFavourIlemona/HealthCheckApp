import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { Tappable } from '../components/ui/Tappable';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthTips'>;

type Category = 'All' | 'Diet' | 'Activity' | 'Sleep' | 'Prevention';

type Tip = {
  id: string;
  category: Exclude<Category, 'All'>;
  title: string;
  summary: string;
  body: string[];
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
};

// Guidance below reflects widely published public-health advice (WHO/NCDC
// style). General information only — not personalised medical advice.
const TIPS: Tip[] = [
  {
    id: 'salt',
    category: 'Diet',
    title: 'Cut back on salt',
    summary: 'High salt intake is a leading driver of high blood pressure.',
    icon: 'shaker-outline',
    body: [
      'Aim for less than 5g of salt (about one teaspoon) per day.',
      'Watch hidden salt in seasoning cubes, tinned foods and processed meats.',
      'Season with pepper, garlic, ginger, curry and herbs instead.',
      'Taste your food before adding extra salt at the table.',
    ],
  },
  {
    id: 'sugar',
    category: 'Diet',
    title: 'Reduce sugary drinks',
    summary: 'Sugary drinks raise blood sugar quickly and add hidden calories.',
    icon: 'cup-water',
    body: [
      'Swap soft drinks and sweetened juices for water or unsweetened drinks.',
      'A single bottle of soft drink can contain more sugar than a full day’s limit.',
      'Watch sweetened teas, energy drinks and flavoured yoghurts too.',
    ],
  },
  {
    id: 'plate',
    category: 'Diet',
    title: 'Build a balanced plate',
    summary: 'Half vegetables, a quarter protein, a quarter carbohydrates.',
    icon: 'food-apple-outline',
    body: [
      'Fill half your plate with vegetables such as ugu, spinach or okra.',
      'Add a palm-sized portion of protein: beans, fish, eggs or lean meat.',
      'Keep starchy foods (rice, yam, garri, bread) to about a quarter.',
      'Choose whole grains and locally available fruit where you can.',
    ],
  },
  {
    id: 'move',
    category: 'Activity',
    title: 'Move for 30 minutes a day',
    summary: '150 minutes of moderate activity a week lowers risk across conditions.',
    icon: 'run',
    body: [
      'Brisk walking, cycling, dancing and housework all count.',
      'Break it up: three 10-minute sessions work as well as one 30-minute block.',
      'Build strength twice a week: squats, push-ups or carrying loads.',
      'If you sit for long periods, stand and stretch every hour.',
    ],
  },
  {
    id: 'weight',
    category: 'Activity',
    title: 'Watch your waist',
    summary: 'Fat around the middle raises diabetes and heart risk most.',
    icon: 'tape-measure',
    body: [
      'Losing even 5–10% of body weight meaningfully improves blood sugar and pressure.',
      'Combine dietary changes with regular activity rather than one alone.',
      'Track progress monthly, not daily, since weight naturally fluctuates.',
    ],
  },
  {
    id: 'sleep',
    category: 'Sleep',
    title: 'Protect your sleep',
    summary: 'Adults need 7–9 hours; too little raises blood sugar and pressure.',
    icon: 'sleep',
    body: [
      'Keep a consistent bedtime and wake time, including weekends.',
      'Avoid caffeine in the late afternoon and evening.',
      'Put screens away 30–60 minutes before bed.',
      'Keep your room as cool, dark and quiet as possible.',
    ],
  },
  {
    id: 'stress',
    category: 'Sleep',
    title: 'Manage daily stress',
    summary: 'Ongoing stress affects blood pressure, sleep and eating habits.',
    icon: 'meditation',
    body: [
      'Try a few minutes of slow, deep breathing when tension builds.',
      'Stay socially connected. Talking things through genuinely helps.',
      'Physical activity is one of the most reliable stress reducers.',
      'Seek support if stress or low mood persists for weeks.',
    ],
  },
  {
    id: 'checks',
    category: 'Prevention',
    title: 'Check your numbers regularly',
    summary: 'Blood pressure and blood sugar often have no symptoms early on.',
    icon: 'heart-pulse',
    body: [
      'Check blood pressure at least yearly, more often if previously raised.',
      'Ask about a blood sugar test if you have family history or are overweight.',
      'Update your health info in HealthCheck after each new reading.',
      'Know your family history, since it changes your baseline risk.',
    ],
  },
  {
    id: 'smoking',
    category: 'Prevention',
    title: 'Stop smoking',
    summary: 'Risk begins dropping within weeks of quitting.',
    icon: 'smoking-off',
    body: [
      'Blood pressure and circulation start improving within days to weeks.',
      'Set a quit date and tell someone who will support you.',
      'Identify your triggers and plan a substitute action for each.',
      'Ask a health professional about support options available to you.',
    ],
  },
  {
    id: 'alcohol',
    category: 'Prevention',
    title: 'Limit alcohol',
    summary: 'Alcohol adds calories and raises blood pressure.',
    icon: 'glass-cocktail-off',
    body: [
      'If you drink, keep it occasional and modest.',
      'Have several alcohol-free days each week.',
      'Avoid alcohol entirely if pregnant or managing liver problems.',
    ],
  },
];

const CATEGORIES: Category[] = ['All', 'Diet', 'Activity', 'Sleep', 'Prevention'];

export function HealthTipsScreen({ navigation }: Props) {
  const [category, setCategory] = useState<Category>('All');
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = category === 'All' ? TIPS : TIPS.filter((tip) => tip.category === category);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Health Tips</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {CATEGORIES.map((option) => (
            <Pressable
              key={option}
              style={[styles.filterChip, category === option && styles.filterChipActive]}
              onPress={() => setCategory(option)}
            >
              <Text style={[styles.filterText, category === option && styles.filterTextActive]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {visible.map((tip, index) => {
          const open = expanded === tip.id;
          return (
            <FadeInUp key={tip.id} index={index}>
              <Tappable style={styles.card} onPress={() => setExpanded(open ? null : tip.id)}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIcon}>
                    <MaterialCommunityIcons
                      name={tip.icon}
                      size={22}
                      color={colors.darkAccentGreen}
                    />
                  </View>
                  <View style={styles.cardTextColumn}>
                    <Text style={styles.cardTitle}>{tip.title}</Text>
                    <Text style={styles.cardSummary}>{tip.summary}</Text>
                  </View>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                </View>

                {open ? (
                  <View style={styles.cardBody}>
                    {tip.body.map((line) => (
                      <View key={line} style={styles.bulletRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.bulletText}>{line}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Tappable>
            </FadeInUp>
          );
        })}

        <View style={styles.disclaimerCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.disclaimerText}>
            General health information only. It does not replace advice from a qualified health
            professional about your own situation.
          </Text>
        </View>
      </ScrollView>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextColumn: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardTitle: {
    fontFamily: fonts.headingMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  cardSummary: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primaryGreen,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  disclaimerCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 20,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
