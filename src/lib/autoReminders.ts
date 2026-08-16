import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAssessmentHistory, latestPerType, normaliseLevel, type RiskAssessment } from './dashboard';
import { enableHealthReminder, type PlanReminder } from './healthReminders';
import { planFor } from './recommendationPlans';
import { getReminderPermissionStatus } from './reminderNotifications';

const HANDLED_KEY = 'healthcheck.autoRemindersHandled';
// Keep the daily total gentle so notifications stay helpful, not spammy.
const MAX_AUTO_REMINDERS = 4;
// Which risk assessments map to a reminder plan, in rough priority order.
const CONDITION_KEYS = ['diabetes', 'hypertension', 'kidney', 'liver', 'stroke'];

// Plan keys we've already auto-enabled once. Tracked so newly-relevant
// conditions switch on over time, but one the user later removes is never
// force-enabled again.
async function getHandled(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(HANDLED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

async function saveHandled(handled: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(HANDLED_KEY, JSON.stringify([...handled]));
  } catch {
    // Non-fatal.
  }
}

type Pick = { planKey: string; reminder: PlanReminder };

/**
 * Picks the reminders to switch on for this user: the top reminder for each
 * condition they're at Moderate/High risk for. If they have no risk data yet,
 * falls back to a single gentle baseline (winding down for sleep). Not yet
 * capped to MAX_AUTO_REMINDERS -- that happens after the merge pass below, so
 * a merge can free up a slot for another condition.
 */
function buildAutoReminders(latest: RiskAssessment[]): Pick[] {
  const relevant = latest
    .filter((a) => {
      const level = normaliseLevel(a.risk_level);
      return level === 'MODERATE' || level === 'HIGH';
    })
    .map((a) => a.assessment_type)
    .filter((type) => CONDITION_KEYS.includes(type));

  if (relevant.length === 0) {
    const sleep = planFor('sleep', null);
    return sleep?.reminders?.[0] ? [{ planKey: 'sleep', reminder: sleep.reminders[0] }] : [];
  }

  const picks: Pick[] = [];
  for (const key of relevant) {
    const plan = planFor(key, null);
    if (plan?.reminders?.[0]) picks.push({ planKey: key, reminder: plan.reminders[0] });
  }
  return picks;
}

// Common words that don't tell us anything about what a reminder is actually
// about, so they're ignored when comparing two messages for similarity.
const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'to', 'it', 'is', 'of', 'your', 'you', 'today', 'if', 'for', 'on',
  'in', 'at', 'do', 'does', 'have', 'has', 'that', 'this', 'or', 'are', 'be',
]);

function significantWords(message: string): Set<string> {
  return new Set(
    message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

/** How much two reminder messages overlap in meaning, from 0 (unrelated) to 1 (same topic). */
function messageSimilarity(a: string, b: string): number {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;
  return shared / Math.min(wordsA.size, wordsB.size);
}

function minutesApart(a: PlanReminder['times'][number], b: PlanReminder['times'][number]): number {
  return Math.abs(a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

/**
 * Two different conditions can end up picking reminders that say almost the
 * same thing within the same hour (e.g. two separate "watch your salt"
 * nudges). When that happens it reads like the same notification firing
 * twice, so we keep the first one and drop the rest. The dropped conditions
 * are still reported so the caller can mark them handled without scheduling
 * a second alarm for them.
 */
function mergeSimilarPicks(picks: Pick[]): { kept: Pick[]; mergedAway: string[] } {
  const kept: Pick[] = [];
  const mergedAway: string[] = [];

  for (const pick of picks) {
    const twin = kept.find(
      (existing) =>
        messageSimilarity(existing.reminder.message, pick.reminder.message) >= 0.4 &&
        existing.reminder.times.some((ta) => pick.reminder.times.some((tb) => minutesApart(ta, tb) < 60)),
    );
    if (twin) mergedAway.push(pick.planKey);
    else kept.push(pick);
  }

  return { kept, mergedAway };
}

let autoEnableInFlight: Promise<void> | null = null;

/**
 * Runs once, the first time notifications are granted: turns on the daily
 * reminders relevant to this user so they don't have to enable each by hand.
 * Safe to call repeatedly, it self-guards on a stored flag and on permission.
 * Also shares one in-flight run so two near-simultaneous callers (Splash and
 * Login can both fire this) never race over the same handled-keys set.
 */
export async function autoEnableRelevantReminders(): Promise<void> {
  if (autoEnableInFlight) return autoEnableInFlight;
  autoEnableInFlight = runAutoEnable();
  try {
    await autoEnableInFlight;
  } finally {
    autoEnableInFlight = null;
  }
}

async function runAutoEnable(): Promise<void> {
  try {
    if ((await getReminderPermissionStatus()) !== 'granted') return; // wait until allowed

    const handled = await getHandled();
    if (handled.size >= MAX_AUTO_REMINDERS) return; // already set up enough

    const latest = latestPerType(await fetchAssessmentHistory());
    const { kept, mergedAway } = mergeSimilarPicks(buildAutoReminders(latest));

    let changed = false;

    // A merged-away condition is covered by another reminder's alarm, so it
    // just needs marking handled -- no new alarm for it.
    for (const planKey of mergedAway) {
      if (!handled.has(planKey)) {
        handled.add(planKey);
        changed = true;
      }
    }

    for (const pick of kept) {
      if (handled.size >= MAX_AUTO_REMINDERS) break;
      if (handled.has(pick.planKey)) continue; // enabled (or since removed) before
      const row = await enableHealthReminder(pick.planKey, pick.reminder);
      handled.add(pick.planKey);
      changed = true;
      void row;
    }
    if (changed) await saveHandled(handled);
  } catch {
    // Non-fatal: reminders can still be toggled manually.
  }
}
