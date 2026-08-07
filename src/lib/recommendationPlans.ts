import type { HealthProfile } from './dashboard';

export type WeeklyPlanItem = {
  day: string;
  activity: string;
  detail: string;
};

export type FoodGuidance = {
  enjoy: string[];
  limit: string[];
};

export type RecommendationPlan = {
  heroTitle: string;
  heroSubtitle: string;
  howToImprove: string[];
  weeklyPlan: WeeklyPlanItem[];
  weeklyPlanNote: string;
  food: FoodGuidance;
};

function sleepPlan(profile: HealthProfile | null): RecommendationPlan {
  const hours = profile?.sleep_hours ?? null;
  return {
    heroTitle:
      hours != null && hours >= 7 && hours <= 9
        ? 'Keep your sleep on track'
        : 'Improve your sleep quality',
    heroSubtitle:
      hours != null
        ? `You're averaging ${hours}h a night. Adults do best on 7-9h.`
        : 'Adults do best on 7-9 hours a night.',
    howToImprove: [
      'Go to bed and wake up at the same time every day, including weekends.',
      "Get sunlight or bright light within an hour of waking. It resets your body clock.",
      'Stop caffeine after 2pm. That includes tea, coffee, energy drinks, cola, and kola nut, which is easy to forget is a stimulant.',
      "Put your phone away 30-60 minutes before bed, and keep it out of arm's reach overnight.",
      'Keep your room as cool, dark and quiet as you can manage.',
      "If you're not asleep after 20 minutes, get up and do something calm in low light, then return to bed.",
    ],
    weeklyPlan: [
      { day: 'Mon', activity: 'Evening walk', detail: '20-30 min, at least 2 hours before bed' },
      { day: 'Tue', activity: 'Rest or light stretching', detail: '10 min gentle stretches before bed' },
      { day: 'Wed', activity: 'Evening walk', detail: '20-30 min, at least 2 hours before bed' },
      { day: 'Thu', activity: 'Rest or light stretching', detail: '10 min gentle stretches before bed' },
      { day: 'Fri', activity: 'Evening walk', detail: '20-30 min, at least 2 hours before bed' },
      { day: 'Sat', activity: 'Any activity you enjoy', detail: '30 min, dancing, football, a long walk' },
      { day: 'Sun', activity: 'Rest', detail: 'Keep the same wake-up time even so' },
    ],
    weeklyPlanNote:
      'Light activity earlier in the day helps you fall asleep faster at night. Avoid anything intense within 2 hours of bedtime.',
    food: {
      enjoy: [
        'A light dinner, finished 2-3 hours before bed',
        'Warm drinks in the evening: lemongrass tea, ginger tea, or unsweetened zobo',
        'Banana or a small handful of groundnuts if you need a bedtime snack',
      ],
      limit: [
        'Tea, coffee, cola, energy drinks, and kola nut after 2pm',
        'Heavy, fried or spicy meals late at night',
        "Alcohol close to bedtime. It disrupts deep sleep even if it makes you drowsy at first",
      ],
    },
  };
}

function weightPlan(profile: HealthProfile | null): RecommendationPlan {
  const bmi = profile?.bmi ?? null;
  const healthy = bmi != null && bmi >= 18.5 && bmi < 25;
  return {
    heroTitle: healthy ? 'Maintain a healthy weight' : 'Work towards a healthier weight',
    heroSubtitle:
      bmi != null
        ? `Your BMI is ${bmi}. A healthy range is 18.5-24.9.`
        : 'A healthy BMI range is 18.5-24.9.',
    howToImprove: [
      'Aim for steady change: 0.5kg a week is realistic and easier to keep off than a crash diet.',
      'Fill half your plate with vegetables before adding starches or protein.',
      "Drink water before meals. It's easy to mistake thirst for hunger.",
      'A few times a week, swap deep-frying for boiling, roasting, or using less oil than usual.',
      'Track your weight monthly, not daily. It naturally goes up and down day to day.',
    ],
    weeklyPlan: [
      { day: 'Mon', activity: 'Brisk walk', detail: '30 min at a pace where talking is a little harder' },
      { day: 'Tue', activity: 'Bodyweight strength', detail: '3 sets of 10-15 squats, push-ups, and sit-ups' },
      { day: 'Wed', activity: 'Brisk walk', detail: '30 min at a pace where talking is a little harder' },
      { day: 'Thu', activity: 'Bodyweight strength', detail: '3 sets of 10-15 squats, push-ups, and sit-ups' },
      { day: 'Fri', activity: 'Brisk walk', detail: '30 min at a pace where talking is a little harder' },
      { day: 'Sat', activity: 'Active fun', detail: '45+ min: football, dancing, a keep-fit session, or a long trek' },
      { day: 'Sun', activity: 'Rest or a gentle walk', detail: 'Let your body recover' },
    ],
    weeklyPlanNote:
      "That's about 150 minutes of moderate activity a week, the amount shown to meaningfully lower diabetes, stroke and heart risk.",
    food: {
      enjoy: [
        'Vegetables like ugu, spinach, and okra, filling half your plate',
        'Beans, fish, eggs, and other lean protein',
        'Whole grains and fruit in place of refined carbs where you can',
      ],
      limit: [
        'Fried foods (puff-puff, chin chin, fried plantain, fried rice in oil)',
        'Sugary drinks and sweetened juices',
        'Large portions of rice, garri, and swallow. Keep starches to about a quarter of the plate',
      ],
    },
  };
}

function smokingPlan(): RecommendationPlan {
  return {
    heroTitle: 'Consider quitting smoking',
    heroSubtitle: 'Smoking raises your risk across every condition this app screens for.',
    howToImprove: [
      'Pick a quit date within the next 2 weeks and tell someone who will hold you to it.',
      "Notice your triggers (stress, alcohol, certain company) and plan what you'll do instead.",
      'Cravings usually pass within 5-10 minutes. Have a plan ready for that window.',
      'Circulation and blood pressure start improving within days to weeks of quitting.',
      "Ask a health professional about support options. You don't have to do this alone.",
    ],
    weeklyPlan: [
      { day: 'Mon', activity: 'Craving-buster walk', detail: '10 min brisk walk whenever you feel the urge' },
      { day: 'Tue', activity: 'Craving-buster walk', detail: '10 min brisk walk whenever you feel the urge' },
      { day: 'Wed', activity: 'Craving-buster walk', detail: '10 min brisk walk whenever you feel the urge' },
      { day: 'Thu', activity: 'Craving-buster walk', detail: '10 min brisk walk whenever you feel the urge' },
      { day: 'Fri', activity: 'Craving-buster walk', detail: '10 min brisk walk whenever you feel the urge' },
      { day: 'Sat', activity: 'Active distraction', detail: '30+ min of something hands-on: sport, chores, a hobby' },
      { day: 'Sun', activity: 'Active distraction', detail: '30+ min of something hands-on: sport, chores, a hobby' },
    ],
    weeklyPlanNote:
      'A short burst of activity is one of the most reliable ways to cut a craving short, and it fills the same "hands and mouth busy" gap smoking used to.',
    food: {
      enjoy: [
        'Water throughout the day. It helps flush nicotine and eases withdrawal',
        'Carrot sticks, cucumber, or chewing gum to occupy your mouth and hands',
        'Fruit instead of a cigarette with your tea or after meals',
      ],
      limit: [
        'Alcohol and coffee early on, since both are common smoking triggers',
        'Skipping meals. Low blood sugar makes cravings feel stronger',
      ],
    },
  };
}

function bloodPressurePlan(): RecommendationPlan {
  return {
    heroTitle: 'Monitor your blood pressure',
    heroSubtitle: 'High blood pressure often has no symptoms, so tracking it matters.',
    howToImprove: [
      'Check your blood pressure at least monthly, and update your health info here after each reading.',
      'Take any prescribed medication exactly as directed, even once you feel fine.',
      "Cut back on salt. It's the single biggest dietary driver of high blood pressure.",
      'Manage stress with regular activity, sleep, and staying connected to people.',
      'See a doctor if a reading is consistently above 140/90.',
    ],
    weeklyPlan: [
      { day: 'Mon', activity: 'Brisk walk', detail: '30 min at a steady, purposeful pace' },
      { day: 'Tue', activity: 'Light strength work', detail: '15-20 min: squats, wall push-ups, step-ups on a stair' },
      { day: 'Wed', activity: 'Brisk walk', detail: '30 min at a steady, purposeful pace' },
      { day: 'Thu', activity: 'Light strength work', detail: '15-20 min: squats, wall push-ups, step-ups on a stair' },
      { day: 'Fri', activity: 'Brisk walk', detail: '30 min at a steady, purposeful pace' },
      { day: 'Sat', activity: 'Active rest', detail: '30+ min of an activity you enjoy' },
      { day: 'Sun', activity: 'Rest', detail: 'A short, gentle walk if you feel like it' },
    ],
    weeklyPlanNote:
      'Regular moderate activity can lower blood pressure by a similar amount to some medications, so it genuinely matters, not just as an add-on.',
    food: {
      enjoy: [
        'Potassium-rich foods: banana, spinach, ugu, beans, and unsalted groundnuts',
        'Fresh herbs and spices (ginger, garlic, curry) instead of salt for flavour',
        'Home-cooked meals, where you control how much salt goes in',
      ],
      limit: [
        'Seasoning cubes, table salt, and salty snacks. Aim for under a teaspoon of salt a day',
        'Tinned and processed foods (corned beef, sardines, instant noodles seasoning)',
        'Salted, dried, or smoked fish and meat',
      ],
    },
  };
}

export function planFor(key: string, profile: HealthProfile | null): RecommendationPlan | null {
  switch (key) {
    case 'sleep':
      return sleepPlan(profile);
    case 'bmi':
      return weightPlan(profile);
    case 'smoking':
      return smokingPlan();
    case 'bp':
      return bloodPressurePlan();
    default:
      return null;
  }
}
