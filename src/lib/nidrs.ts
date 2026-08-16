/**
 * Nigerian Diet Risk Score (NiDRS) — a validated, Nigeria-specific dietary
 * risk score for hypertension (Batubo et al., 2025; derived and internally
 * validated at Rivers State University Teaching Hospital, AUC 0.92).
 *
 * Each of 11 food groups scores its full weight when the person's intake
 * crosses that food's threshold, else 0. Total 0-30; >11.3 = high dietary
 * risk. Weights are the study's β-coefficients rounded to the nearest
 * integer, already adjusted for age, BMI, physical activity and sex — so this
 * is specifically the DIETARY layer of risk.
 *
 * See api/HYPERTENSION_METHODOLOGY.md for the full derivation and sources.
 */

/** The four consumption levels the app asks about, ordered least → most. */
export type FoodFrequency = 'rarely' | 'w12' | 'w35' | 'daily';
const FREQ_ORDER: FoodFrequency[] = ['rarely', 'w12', 'w35', 'daily'];

export type NidrsFood = {
  key: string;
  label: string;
  examples: string;
  /** Intake at or above this level scores the food's points. */
  threshold: FoodFrequency;
  points: number;
};

// Exact points and thresholds from Table 5.5 of the source thesis.
export const NIDRS_FOODS: NidrsFood[] = [
  { key: 'fried_foods', label: 'Fried foods', examples: 'akara, puff-puff, chin-chin, fried plantain/yam, fried fish or chicken', threshold: 'w35', points: 4 },
  { key: 'eggs', label: 'Eggs', examples: 'boiled, fried, or scrambled eggs', threshold: 'w12', points: 3 },
  { key: 'red_meat', label: 'Red meat', examples: 'beef, goat, pork, bush meat', threshold: 'w35', points: 3 },
  { key: 'processed_meat', label: 'Processed meat', examples: 'suya, kilishi, sausages, gala, corned beef, meat pies', threshold: 'w12', points: 3 },
  { key: 'desserts', label: 'Desserts & sweets', examples: 'ice cream, biscuits, cakes, chocolate, sweets', threshold: 'w12', points: 3 },
  { key: 'soft_drinks', label: 'Soft & sweet drinks', examples: 'Coke, Fanta, Malt, sweetened zobo/kunu, energy drinks, juice', threshold: 'w35', points: 3 },
  { key: 'alcohol', label: 'Alcohol', examples: 'beer, wine, spirits', threshold: 'w12', points: 3 },
  { key: 'salt', label: 'Salt & seasonings', examples: 'table salt, Maggi/Knorr cubes, soy/oyster sauce', threshold: 'daily', points: 3 },
  { key: 'fast_foods', label: 'Fast foods', examples: 'mama put, shawarma, jollof rice, small chops, burgers, chicken rolls', threshold: 'w35', points: 2 },
  { key: 'fats_oils', label: 'Fats & oils', examples: 'food cooked with palm/vegetable oil, butter, margarine, mayonnaise', threshold: 'daily', points: 2 },
  { key: 'soups_stews', label: 'Soups & stews', examples: 'egusi, banga, groundnut, efo-riro, ogbono, ewedu, oily stews', threshold: 'daily', points: 1 },
];

/** Points at or above this total are classed as high dietary risk (source cut-off). */
export const NIDRS_HIGH_CUTOFF = 11.3;
export const NIDRS_MAX = 30;

export type DietFrequencies = Record<string, FoodFrequency>;

function scoresPoints(answer: FoodFrequency | undefined, threshold: FoodFrequency): boolean {
  if (!answer) return false;
  return FREQ_ORDER.indexOf(answer) >= FREQ_ORDER.indexOf(threshold);
}

export type NidrsResult = {
  score: number;
  category: 'low' | 'high';
  /** Which foods contributed points, for the breakdown display. */
  contributors: { key: string; label: string; points: number }[];
  /** How many of the 11 foods were answered (a fuller answer = a better estimate). */
  answered: number;
};

export function computeNidrs(diet: DietFrequencies | null | undefined): NidrsResult {
  const answers = diet ?? {};
  let score = 0;
  let answered = 0;
  const contributors: { key: string; label: string; points: number }[] = [];

  for (const food of NIDRS_FOODS) {
    const answer = answers[food.key];
    if (answer) answered += 1;
    if (scoresPoints(answer, food.threshold)) {
      score += food.points;
      contributors.push({ key: food.key, label: food.label, points: food.points });
    }
  }

  return {
    score,
    category: score > NIDRS_HIGH_CUTOFF ? 'high' : 'low',
    contributors,
    answered,
  };
}
