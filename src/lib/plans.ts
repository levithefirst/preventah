import { CONDITION_KEYS, type ConditionKey, labelFor } from './conditions';

/**
 * The deterministic prevention plan table.
 *
 * Design rules, all of which matter:
 *  - Pure data plus pure functions. No network call, no LLM, no async.
 *    Resolving a plan cannot fail and cannot be slow.
 *  - Every category carries exactly SLOTS_PER_CATEGORY entries per action
 *    type, so indexing by day can never fall off the end of an array.
 *  - Output is a pure function of (selected categories, day index), so the
 *    same inputs always produce the same plan. That is what lets the UI
 *    render instantly and the server render the same thing.
 *
 * The guidance is general lifestyle guidance, not medical advice. The UI
 * states this plainly.
 */

export const SLOTS_PER_CATEGORY = 7;

interface CategoryPlan {
  diet: readonly string[];
  exercise: readonly string[];
  habit: readonly string[];
}

const TABLE: Record<ConditionKey, CategoryPlan> = {
  cardiovascular: {
    diet: [
      'Swap one portion of red or processed meat for oily fish, beans or lentils.',
      'Cook with olive oil instead of butter today.',
      'Add a handful of unsalted nuts as your snack.',
      'Keep added salt under one teaspoon across the whole day.',
      'Make half your lunch plate vegetables.',
      'Choose wholegrain bread, rice or pasta at every meal today.',
      'Skip sugary drinks entirely; water, tea or coffee only.',
    ],
    exercise: [
      'Walk briskly for 30 minutes, fast enough that talking takes effort.',
      'Take the stairs every time you meet them today.',
      'Do 20 minutes of cycling, swimming or a dance workout.',
      'Break up sitting with 5 minutes of movement every hour.',
      'Walk 20 minutes after your largest meal.',
      'Do a 25-minute steady cardio session of your choice.',
      'Take a long, relaxed walk; aim for 45 minutes.',
    ],
    habit: [
      'Check your blood pressure if you have a cuff, and write the number down.',
      'Go to bed at a fixed time tonight; short sleep raises blood pressure.',
      'Do 5 minutes of slow breathing, six breaths per minute.',
      'Log anything you smoked or vaped today, honestly, without judgement.',
      'Read the salt content on one packaged food before you buy it.',
      'Keep alcohol to zero or one drink today.',
      'Write down one stressor and one thing you can control about it.',
    ],
  },
  type2_diabetes: {
    diet: [
      'Eat protein or vegetables before the carbohydrate part of each meal.',
      'Cut sugary drinks to zero today, including fruit juice.',
      'Choose a wholegrain or high-fibre carbohydrate at every meal.',
      'Add a portion of beans, chickpeas or lentils to one meal.',
      'Keep to three meals with no grazing in between.',
      'Make breakfast savoury and protein-led rather than sweet.',
      'Fill half your dinner plate with non-starchy vegetables.',
    ],
    exercise: [
      'Walk for 15 minutes within an hour of your biggest meal.',
      'Do two sets of 10 sit-to-stands from a chair, twice today.',
      'Do 30 minutes of brisk walking or cycling.',
      'Add a short resistance session: squats, rows, press-ups.',
      'Stand up and move for 3 minutes every half hour of sitting.',
      'Do 20 minutes of interval walking: 1 minute fast, 2 minutes easy.',
      'Choose an active outing rather than a seated one.',
    ],
    habit: [
      'Note your waist measurement, or just how your waistband feels.',
      'Sleep seven hours tonight; short sleep worsens insulin resistance.',
      'Read the sugar line on one label before eating it.',
      'Plan tomorrow’s lunch now so you are not choosing while hungry.',
      'Drink water before each meal.',
      'Track everything you drank today.',
      'Book or diary-note a check of your blood sugar with your clinician.',
    ],
  },
  cancer_family_history: {
    diet: [
      'Eat 30g of fibre today: wholegrains, beans, fruit, vegetables.',
      'Cut processed meat entirely today.',
      'Eat five distinct colours of plant food.',
      'Keep alcohol at zero today.',
      'Swap a refined snack for fruit or vegetables.',
      'Add a portion of cruciferous vegetables: broccoli, cabbage, kale.',
      'Cook from whole ingredients for at least one meal.',
    ],
    exercise: [
      'Move briskly for 30 minutes; regular activity lowers several risks.',
      'Take a 40-minute walk outdoors.',
      'Do a 20-minute strength session.',
      'Break up every hour of sitting with movement.',
      'Do 30 minutes of any activity that raises your heart rate.',
      'Walk or cycle instead of driving for one trip.',
      'Do something active you actually enjoy for 30 minutes.',
    ],
    habit: [
      'Check you are up to date on the screenings offered for your age.',
      'Apply sun protection if you will be outside.',
      'Write down your known family history once, so you can tell a clinician clearly.',
      'Keep alcohol-free days deliberate rather than accidental.',
      'Log any tobacco use today.',
      'Sleep seven to eight hours tonight.',
      'Note one question to ask your doctor at your next appointment.',
    ],
  },
  hypertension: {
    diet: [
      'Keep added salt under one teaspoon for the whole day.',
      'Check the salt content of every packaged item you eat today.',
      'Add potassium-rich foods: spinach, beans, bananas, potatoes.',
      'Cook one meal from scratch so you control the salt.',
      'Skip processed meat and salty snacks today.',
      'Eat two portions of vegetables at your main meal.',
      'Replace a salty snack with unsalted nuts.',
    ],
    exercise: [
      'Walk briskly for 30 minutes.',
      'Do 20 minutes of steady cardio.',
      'Try isometric holds: three 2-minute wall sits with rests.',
      'Cycle or swim for 25 minutes.',
      'Take two 15-minute walks rather than one long one.',
      'Do a 30-minute activity that leaves you slightly breathless.',
      'Walk somewhere green for 40 minutes.',
    ],
    habit: [
      'Measure your blood pressure and record it.',
      'Do 5 minutes of slow breathing.',
      'Keep alcohol to zero or one drink.',
      'Get to bed at a consistent time tonight.',
      'Take any prescribed medication at the same time as yesterday.',
      'Note your resting heart rate before getting up.',
      'Review your week’s blood pressure notes for a pattern.',
    ],
  },
  metabolic_syndrome: {
    diet: [
      'Build every meal around protein, vegetables and a wholegrain.',
      'Cut sugary drinks and juice to zero.',
      'Stop eating three hours before bed.',
      'Swap one ultra-processed item for a whole food.',
      'Eat to comfortably full, not stuffed, at each meal.',
      'Add a high-fibre food to every meal.',
      'Plan and cook one meal deliberately rather than by default.',
    ],
    exercise: [
      'Do 30 minutes of brisk walking.',
      'Do a full-body strength session: legs, push, pull.',
      'Walk 15 minutes after two different meals.',
      'Do 20 minutes of intervals at an effort you can sustain.',
      'Hit 8,000 steps however you like.',
      'Do 30 minutes of cardio plus 10 of strength.',
      'Take an active rest day: a long, easy walk.',
    ],
    habit: [
      'Weigh yourself or check your waistband, and record it.',
      'Sleep seven to eight hours tonight.',
      'Write down what you ate today without editing it.',
      'Drink water instead of your usual sweet drink.',
      'Notice one trigger that leads you to snack unplanned.',
      'Set out tomorrow’s exercise clothes tonight.',
      'Review the week and pick the single habit that worked best.',
    ],
  },
  osteoporosis: {
    diet: [
      'Get a good calcium source: dairy, fortified plant milk, tofu or sardines.',
      'Check whether you need vitamin D, especially in winter.',
      'Eat protein at every meal; bone is protein as well as mineral.',
      'Add leafy greens: kale, pak choi, broccoli.',
      'Keep fizzy cola drinks to zero today.',
      'Include a portion of tinned fish with bones, or fortified alternatives.',
      'Keep alcohol low; it works against bone density.',
    ],
    exercise: [
      'Do 20 minutes of weight-bearing exercise: walking, stair climbing, dancing.',
      'Do a resistance session: squats, rows, press-ups against a wall.',
      'Practise balance: stand on one leg, 30 seconds each side, twice.',
      'Take a brisk 30-minute walk on varied ground.',
      'Do controlled step-ups onto a low step.',
      'Do a 20-minute strength session focused on hips and spine.',
      'Combine a walk with 10 minutes of balance work.',
    ],
    habit: [
      'Check your home for trip hazards: loose rugs, trailing cables, dark stairs.',
      'Get 10 to 15 minutes of daylight on your skin if you safely can.',
      'Log any tobacco use; smoking accelerates bone loss.',
      'Stand tall and check your posture at your desk.',
      'Ask whether a bone density scan is appropriate for you.',
      'Keep alcohol to zero or one drink.',
      'Review your balance practice for the week.',
    ],
  },
};

/**
 * Fallback used when a user has selected no categories yet. Prevention
 * advice that applies to everyone, so the plan view is never empty and
 * never errors.
 */
const BASELINE: CategoryPlan = {
  diet: [
    'Eat five portions of fruit and vegetables today.',
    'Drink water instead of one sweet drink.',
    'Add a wholegrain to one meal.',
    'Eat protein at breakfast.',
    'Cook one meal from whole ingredients.',
    'Add one portion of beans, peas or lentils.',
    'Keep added salt under one teaspoon.',
  ],
  exercise: [
    'Walk briskly for 30 minutes.',
    'Take the stairs whenever you meet them.',
    'Do 20 minutes of activity you enjoy.',
    'Break up long sitting every hour.',
    'Do a short strength session.',
    'Walk 15 minutes after your largest meal.',
    'Take a long, easy walk.',
  ],
  habit: [
    'Sleep seven to eight hours tonight.',
    'Do 5 minutes of slow breathing.',
    'Keep alcohol to zero or one drink.',
    'Go to bed at a consistent time.',
    'Get outside in daylight for 15 minutes.',
    'Write down one thing that went well.',
    'Review your week and pick one habit to keep.',
  ],
};

export interface PlanItem {
  text: string;
  /** Which selected category drove this line, for display. Null on baseline. */
  sourceKey: ConditionKey | null;
  sourceLabel: string;
}

export interface DailyPlan {
  dayIndex: number;
  diet: PlanItem;
  exercise: PlanItem;
  habit: PlanItem;
  /** True when no categories were selected and the baseline plan was used. */
  isBaseline: boolean;
}

function pick(
  keys: readonly ConditionKey[],
  dayIndex: number,
  offset: number,
  kind: keyof CategoryPlan,
): PlanItem {
  if (keys.length === 0) {
    return {
      text: BASELINE[kind][dayIndex % SLOTS_PER_CATEGORY],
      sourceKey: null,
      sourceLabel: 'General prevention',
    };
  }
  // Rotate which category drives each slot so a multi-select profile gets a
  // blended plan rather than one category dominating every line.
  const key = keys[(dayIndex + offset) % keys.length];
  return {
    text: TABLE[key][kind][dayIndex % SLOTS_PER_CATEGORY],
    sourceKey: key,
    sourceLabel: labelFor(key),
  };
}

/**
 * Resolves the plan for a given set of categories and day index.
 * Pure, synchronous, total: every input produces a plan.
 */
export function getDailyPlan(
  selected: readonly ConditionKey[],
  dayIndex: number,
): DailyPlan {
  // Normalise to canonical order so plan output does not depend on the order
  // the client happened to send the keys in.
  const keys = CONDITION_KEYS.filter((k) => selected.includes(k));
  const safeDay =
    Number.isFinite(dayIndex) && dayIndex >= 0 ? Math.floor(dayIndex) : 0;

  return {
    dayIndex: safeDay,
    diet: pick(keys, safeDay, 0, 'diet'),
    exercise: pick(keys, safeDay, 1, 'exercise'),
    habit: pick(keys, safeDay, 2, 'habit'),
    isBaseline: keys.length === 0,
  };
}

/** Whole days elapsed since `start`, in UTC. Day 0 is the start date. */
export function dayIndexSince(start: Date, now: Date = new Date()): number {
  const startUtc = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.max(0, Math.floor((nowUtc - startUtc) / 86_400_000));
}

/** Stable day index for users with no active stake, so the plan still rotates. */
export function calendarDayIndex(now: Date = new Date()): number {
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
}
