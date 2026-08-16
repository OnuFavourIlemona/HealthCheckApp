import type { HealthProfile } from './dashboard';
import type { PlanReminder } from './healthReminders';

export type WeeklyPlanItem = {
  day: string;
  activity: string;
  detail: string;
};

export type FoodGuidance = {
  enjoy: string[];
  limit: string[];
};

export type WarningSigns = {
  intro: string;
  signs: string[];
  /** The red-alert line for signs that need a hospital straight away. */
  urgentNote: string;
};

export type RecommendationPlan = {
  heroTitle: string;
  heroSubtitle: string;
  howToImprove: string[];
  weeklyPlan: WeeklyPlanItem[];
  weeklyPlanNote: string;
  food: FoodGuidance;
  /** Daily habits the user can switch on as phone reminders. */
  reminders?: PlanReminder[];
  /** Signs that should send the person to a doctor, shown in a highlighted card. */
  warningSigns?: WarningSigns;
};

// A reusable, everyday activity week for the condition plans, so we don't
// repeat the same seven lines in each one.
const ACTIVITY_WEEK: WeeklyPlanItem[] = [
  { day: 'Mon', activity: 'Brisk walk', detail: '30 min at a pace where talking is a little harder' },
  { day: 'Tue', activity: 'Light strength work', detail: '15-20 min: squats, wall push-ups, step-ups on a stair' },
  { day: 'Wed', activity: 'Brisk walk', detail: '30 min at a steady, purposeful pace' },
  { day: 'Thu', activity: 'Light strength work', detail: '15-20 min: squats, wall push-ups, step-ups on a stair' },
  { day: 'Fri', activity: 'Brisk walk', detail: '30 min at a steady, purposeful pace' },
  { day: 'Sat', activity: 'Something you enjoy', detail: '30+ min: football, dancing, a keep-fit session, a long trek' },
  { day: 'Sun', activity: 'Rest or a gentle walk', detail: 'Let your body recover' },
];

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
    reminders: [
      {
        key: 'winddown',
        label: 'Time to wind down',
        message: 'Time to wind down. Put the phone away and get ready for a good sleep tonight.',
        times: [{ hour: 21, minute: 30 }],
        icon: 'sleep',
      },
    ],
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
    reminders: [
      {
        key: 'salt',
        label: 'Go easy on salt',
        message: 'Go easy on salt and Maggi today. Less salt keeps your blood pressure down.',
        times: [{ hour: 11, minute: 30 }],
        icon: 'shaker-outline',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Per-condition plans (one for each prediction), in plain, everyday language.
// ---------------------------------------------------------------------------

function diabetesPlan(): RecommendationPlan {
  return {
    heroTitle: 'Protect yourself from diabetes',
    heroSubtitle: 'Small daily habits keep your blood sugar steady and lower your risk.',
    howToImprove: [
      'Cut down on sugary drinks. Soft drinks, sweetened juice, and heavy sugar in tea and pap are the fastest way to spike your sugar.',
      'Move most days. Even a 30-minute walk helps your body use sugar better.',
      'Fill half your plate with vegetables before you add rice, garri, or swallow.',
      'If you feel very thirsty, tired, or you are passing urine often, get your blood sugar checked. Do not wait.',
      'If diabetes runs in your family, get a fasting blood sugar or HbA1c test at least once a year.',
    ],
    weeklyPlan: ACTIVITY_WEEK,
    weeklyPlanNote:
      'About 150 minutes of activity a week is enough to meaningfully lower diabetes risk. Spread it across the week.',
    food: {
      enjoy: [
        'Vegetables like ugu, efo, okra, and garden egg',
        'Beans, fish, eggs, and other protein that fills you up',
        'Fruit in place of sweets, and water in place of soft drinks',
      ],
      limit: [
        'Soft drinks, energy drinks, and sweetened juice',
        'Big portions of white rice, garri, and swallow. Keep them to about a quarter of the plate',
        'Fried snacks and sugary treats between meals',
      ],
    },
    reminders: [
      {
        key: 'move',
        label: 'Time to move',
        message: 'Did you take a walk today? A short walk helps your body keep blood sugar steady.',
        times: [{ hour: 16, minute: 0 }],
        icon: 'run',
      },
      {
        key: 'veg',
        label: 'Eat well today',
        message: 'Fill half your plate with vegetables on your next meal. It steadies your blood sugar.',
        times: [{ hour: 18, minute: 30 }],
        icon: 'food-apple-outline',
      },
    ],
  };
}

function hypertensionPlan(): RecommendationPlan {
  return {
    heroTitle: 'Keep your blood pressure down',
    heroSubtitle: 'High blood pressure is quiet, so daily care and checking matter most.',
    howToImprove: [
      'Use less salt and fewer seasoning cubes. This is the single biggest thing you can change.',
      'If a doctor gave you blood pressure medicine, take it every day, even when you feel fine.',
      'Check your blood pressure when you can, and update it here. Many chemists and pharmacies check it cheaply.',
      'Stay active most days and keep a healthy weight.',
      'See a doctor if your reading is often above 140 over 90.',
    ],
    weeklyPlan: ACTIVITY_WEEK,
    weeklyPlanNote:
      'Regular activity can lower blood pressure by about as much as some medicines, so it truly counts.',
    food: {
      enjoy: [
        'Foods rich in potassium: banana, spinach, ugu, beans, and unsalted groundnuts',
        'Ginger, garlic, and fresh herbs for flavour instead of salt',
        'Home-cooked meals where you decide how much salt goes in',
      ],
      limit: [
        'Seasoning cubes, table salt, and salty snacks',
        'Tinned and processed foods like corned beef and instant noodle seasoning',
        'Dried and smoked fish and meat that carry a lot of salt',
      ],
    },
    reminders: [
      {
        key: 'meds',
        label: 'Blood pressure medicine',
        message: 'Have you taken your blood pressure medicine today?',
        times: [{ hour: 8, minute: 0 }],
        icon: 'pill',
      },
      {
        key: 'salt',
        label: 'Go easy on salt',
        message: 'Go easy on salt and Maggi today. Your blood pressure will thank you.',
        times: [{ hour: 11, minute: 30 }],
        icon: 'shaker-outline',
      },
    ],
  };
}

function strokePlan(): RecommendationPlan {
  return {
    heroTitle: 'Lower your chance of a stroke',
    heroSubtitle: 'A stroke is mostly preventable by keeping your heart and vessels healthy.',
    howToImprove: [
      'Control your blood pressure. High blood pressure is the number one cause of stroke.',
      'If you smoke, work towards stopping. It is one of the biggest stroke risks and one you can remove.',
      'Keep your blood sugar in check, especially if diabetes runs in your family.',
      'Stay active and keep to a healthy weight.',
      'Learn the warning signs: sudden weakness on one side, a drooping face, or trouble speaking. If you see them, get to a hospital fast.',
    ],
    weeklyPlan: ACTIVITY_WEEK,
    weeklyPlanNote:
      'Moving most days lowers blood pressure, sugar, and weight all at once, the three biggest stroke risks.',
    food: {
      enjoy: [
        'Plenty of vegetables and fruit',
        'Fish, beans, and other lean protein',
        'Ginger and garlic for flavour instead of salt',
      ],
      limit: [
        'Salt, seasoning cubes, and salty snacks',
        'Fried and fatty foods eaten often',
        'Heavy alcohol, which pushes blood pressure up',
      ],
    },
    warningSigns: {
      intro:
        'A stroke is an emergency, and acting fast saves lives and prevents lasting damage. Remember the word FAST:',
      signs: [
        'Face: one side of the face droops or looks uneven',
        'Arm: one arm or leg is suddenly weak or numb',
        'Speech: speech is slurred, strange, or hard to understand',
        'Sudden confusion, trouble seeing, or a very severe headache',
      ],
      urgentNote:
        'If you notice any of these, even briefly, get to a hospital straight away. The first few hours matter most.',
    },
    reminders: [
      {
        key: 'move',
        label: 'Move your body',
        message: 'Have you exercised today? Staying active keeps your blood pressure and stroke risk down.',
        times: [{ hour: 15, minute: 0 }],
        icon: 'run',
      },
    ],
  };
}

function kidneyPlan(): RecommendationPlan {
  return {
    heroTitle: 'Protect your kidneys',
    heroSubtitle: 'Kidney damage is silent, so daily care and early testing matter most.',
    howToImprove: [
      'Drink enough clean water through the day, especially in hot weather. It helps your kidneys flush out waste.',
      'Stop taking painkillers like ibuprofen, diclofenac, and APC unless you really need them. Taken often, they harm the kidneys.',
      'Be careful with herbal mixtures like agbo and paraga. You cannot know what is inside, and some are hard on the kidneys.',
      'Keep your blood pressure and blood sugar under control. These are the two biggest causes of kidney failure.',
      'Because kidney damage shows no early signs, ask for a simple kidney test (blood and urine) at least once a year if you have any risk factors.',
    ],
    weeklyPlan: ACTIVITY_WEEK,
    weeklyPlanNote:
      'Staying active helps control blood pressure and sugar, which are the main things that protect your kidneys.',
    food: {
      enjoy: [
        'Clean water through the day, about 6 to 8 cups',
        'Fresh vegetables and fruit',
        'Home-cooked meals with light salt',
      ],
      limit: [
        'Salt, seasoning cubes, and very salty foods',
        'Soft drinks and too many processed, packaged foods',
        'Painkillers and herbal mixtures taken often',
      ],
    },
    warningSigns: {
      intro:
        'Kidney damage is silent for a long time, so these signs mean you should see a doctor and ask for a kidney test. Do not wait for them to pass.',
      signs: [
        'Swelling in the feet, ankles, legs, or puffiness around the eyes, especially in the morning',
        'Foamy or bubbly urine',
        'Blood in the urine, or urine that looks dark or cola-coloured',
        'Passing much less urine, or waking many times at night to urinate',
        'Itchy skin, poor appetite, or feeling sick without a clear reason',
        'Tiredness and weakness that does not go away with rest',
      ],
      urgentNote:
        'Passing little or no urine, heavy swelling, or trouble breathing need urgent hospital care. Go straight away.',
    },
    reminders: [
      {
        key: 'water',
        label: 'Drink water',
        message: 'Have you drank water today? Water helps your kidneys flush out waste and stay healthy.',
        times: [{ hour: 10, minute: 0 }],
        icon: 'cup-water',
      },
      {
        key: 'water2',
        label: 'Drink water',
        message: 'Try to drink 2 to 3 litres of water a day. Doctors recommend it to keep your kidneys healthy.',
        times: [{ hour: 17, minute: 0 }],
        icon: 'cup-water',
      },
      {
        key: 'painkillers',
        label: 'Skip needless painkillers',
        message: 'Only take pain medicine if you really need it today. Cutting back protects your kidneys.',
        times: [{ hour: 9, minute: 0 }],
        icon: 'pill',
      },
    ],
  };
}

function liverPlan(): RecommendationPlan {
  return {
    heroTitle: 'Protect your liver',
    heroSubtitle: 'Liver damage is silent for years, so testing and daily care matter most.',
    howToImprove: [
      'Get tested for hepatitis B and C if you never have. Most people who carry it feel completely fine, and a simple blood test is the only way to know.',
      'If you test negative for hepatitis B, get the vaccine. It fully prevents the infection.',
      'Cut down on alcohol, or stop. It is the top cause of serious liver disease in Nigeria.',
      'Be very careful with painkillers, especially paracetamol. Never take more than the dose on the pack, and never mix several medicines at once.',
      'Be careful with herbal mixtures like agbo. Natural does not mean safe, and some are toxic to the liver.',
      'Keep a healthy weight and cut sugary drinks and processed food to avoid fatty liver.',
      'See a doctor quickly if your eyes or skin turn yellow, your urine is dark, or you feel very tired for a long time. These can be signs of liver trouble.',
    ],
    weeklyPlan: ACTIVITY_WEEK,
    weeklyPlanNote:
      'Regular activity and weight loss are the most effective way to clear fat from the liver, and 30 minutes most days is enough.',
    food: {
      enjoy: [
        'Vegetables, fruit, and beans',
        'Water and unsweetened drinks in place of soft drinks',
        'Home-cooked meals with less oil and sugar',
      ],
      limit: [
        'Alcohol of all kinds',
        'Soft drinks, sweetened juice, and heavy sugar',
        'Fried, fatty, and heavily processed foods',
      ],
    },
    warningSigns: {
      intro:
        'Early liver damage is silent, so these signs mean you should see a doctor without delay. Do not treat them at home or wait for them to pass.',
      signs: [
        'Yellow eyes or yellow skin (jaundice)',
        'Dark, tea-coloured urine',
        'Pale or clay-coloured stools',
        'A swollen, tight belly, or swelling in the legs and ankles',
        'Easy bruising, bleeding gums, or frequent nosebleeds',
        'Itchy skin without any rash',
        'Deep tiredness that does not go away with rest',
      ],
      urgentNote:
        'Vomiting blood, confusion, or drowsiness you cannot shake off are emergencies. Get to a hospital straight away.',
    },
    reminders: [
      {
        key: 'alcohol',
        label: 'Go easy on alcohol',
        message: 'Try to skip alcohol today. Every alcohol-free day gives your liver time to heal.',
        times: [{ hour: 18, minute: 0 }],
        icon: 'glass-mug-variant',
      },
      {
        key: 'safemeds',
        label: 'Use medicine safely',
        message: 'Only take medicine when you truly need it today, and at the correct dose. It protects your liver.',
        times: [{ hour: 9, minute: 30 }],
        icon: 'pill',
      },
    ],
  };
}

/**
 * A general wellness nudge, not tied to any one condition or risk result --
 * shown in the Reminders screen alongside the condition-based ones, but
 * doesn't have a full recommendation detail page behind it.
 */
export const CHECKUP_REMINDER: PlanReminder = {
  key: 'monthly',
  label: 'Check your numbers this month',
  message:
    'Try to check your blood pressure and blood sugar this month, then update them in your Health Info. It keeps your risk checks accurate and can catch problems early.',
  times: [{ hour: 10, minute: 0 }],
  icon: 'clipboard-pulse-outline',
  cadence: 'monthly',
  monthlyDay: 1,
};

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
    case 'diabetes':
      return diabetesPlan();
    case 'hypertension':
      return hypertensionPlan();
    case 'stroke':
      return strokePlan();
    case 'kidney':
      return kidneyPlan();
    case 'liver':
      return liverPlan();
    default:
      return null;
  }
}
