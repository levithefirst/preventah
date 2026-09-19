import type { PlanItem, PlanItemType } from './plans';
import type { PlanTag } from './conditionTypes';

/**
 * Spend tiers for a daily action.
 *
 * The premise: the same prevention action is available at three budgets,
 * and the free one is always a real option rather than a teaser. Someone
 * who never spends a penny still completes the loop every day. The paid
 * tiers buy convenience or equipment, never a different outcome, and the
 * copy is not allowed to imply otherwise.
 *
 * Tiers are derived, not stored. A tier is a pure function of the plan
 * item, so the server and the browser resolve the same three options for
 * the same day without coordinating, and adding a plan item never needs a
 * matching tier row.
 */

export const TIERS = ['free', 'cheap', 'premium'] as const;
export type Tier = (typeof TIERS)[number];

export interface TierOption {
  tier: Tier;
  /** Shown on the button. */
  label: string;
  /** What you actually do at this tier. One imperative line. */
  title: string;
  /** Rough outlay, in plain words. Never a live price. */
  costHint: string;
}

export interface TieredAction {
  /** Plan content id. What a check-in row stores. */
  id: string;
  type: PlanItemType;
  title: string;
  description: string;
  why: string;
  howTo: string[];
  benefit: string;
  target: string;
  safetyNote: string | null;
  relatedConditions: string[];
  matchedTags: PlanTag[];
  sourceName: string;
  sourceUrl: string;
  options: TierOption[];
}

interface TierCopy {
  cheap: { title: string; costHint: string };
  premium: { title: string; costHint: string };
}

/**
 * Upgrades by tag, most specific first when an item carries several.
 * Every entry names something you could actually buy today.
 */
const BY_TAG: Partial<Record<PlanTag, TierCopy>> = {
  activity: {
    cheap: { title: 'Do it with a resistance band or a skipping rope.', costHint: 'about the price of a coffee round' },
    premium: { title: 'Do it as a booked class or a session with a trainer.', costHint: 'gym or class pricing' },
  },
  'diet-quality': {
    cheap: { title: 'Buy a frozen vegetable bag and use it for this meal.', costHint: 'a few pounds' },
    premium: { title: 'Order a veg box or a prepped-meal delivery for the week.', costHint: 'a weekly subscription' },
  },
  'diet-fibre': {
    cheap: { title: 'Pick up oats, beans or lentils on the way home.', costHint: 'a few pounds' },
    premium: { title: 'Set up a recurring wholegrain and pulse delivery.', costHint: 'a weekly subscription' },
  },
  'diet-salt': {
    cheap: { title: 'Buy one no-salt-added version of something you eat weekly.', costHint: 'a small premium per item' },
    premium: { title: 'Switch the store-cupboard staples to low-salt versions in one shop.', costHint: 'a one-off bigger shop' },
  },
  'diet-sugar': {
    cheap: { title: 'Buy sparkling water or a no-sugar swap for your usual drink.', costHint: 'a few pounds' },
    premium: { title: 'Get a sparkling water maker so the swap needs no willpower.', costHint: 'a one-off appliance' },
  },
  weight: {
    cheap: { title: 'Get a set of kitchen scales and weigh one portion today.', costHint: 'a one-off, under a takeaway' },
    premium: { title: 'Book a session with a registered dietitian.', costHint: 'a professional consultation' },
  },
  sleep: {
    cheap: { title: 'Add an eye mask or earplugs to tonight.', costHint: 'a few pounds' },
    premium: { title: 'Fit a blackout blind, or see a clinician about persistent poor sleep.', costHint: 'a one-off fitting or an appointment' },
  },
  stress: {
    cheap: { title: 'Use a free trial of a guided breathing app for today.', costHint: 'free trial, then a subscription' },
    premium: { title: 'Book a session with a talking therapist.', costHint: 'a professional session' },
  },
  'mental-wellbeing': {
    cheap: { title: 'Put the call on a prepaid card or a cheap plan and actually make it.', costHint: 'pennies' },
    premium: { title: 'Book a session with a talking therapist.', costHint: 'a professional session' },
  },
  tobacco: {
    cheap: { title: 'Pick up nicotine gum or patches from a pharmacy.', costHint: 'a pharmacy purchase' },
    premium: { title: 'Book into a stop-smoking service for structured support.', costHint: 'free in some countries, otherwise a clinic fee' },
  },
  alcohol: {
    cheap: { title: 'Buy a decent alcohol-free version of what you would have had.', costHint: 'roughly the same as the original' },
    premium: { title: 'Talk to a clinician or a specialist service about cutting down.', costHint: 'a professional consultation' },
  },
  'bone-strength': {
    cheap: { title: 'Get a resistance band and add two weight-bearing sets.', costHint: 'a few pounds' },
    premium: { title: 'Join a supervised strength class built for bone loading.', costHint: 'class pricing' },
  },
  screening: {
    cheap: { title: 'Call and book the appointment you have been putting off.', costHint: 'the price of a phone call' },
    premium: { title: 'Book privately if the wait for the routine service is long.', costHint: 'private appointment pricing' },
  },
  'sun-safety': {
    cheap: { title: 'Buy a broad-spectrum SPF30+ and keep it by the door.', costHint: 'a few pounds' },
    premium: { title: 'Book a skin check with a clinician.', costHint: 'a professional appointment' },
  },
  breathing: {
    cheap: { title: 'Get a peak flow meter and record today.', costHint: 'a pharmacy purchase' },
    premium: { title: 'Ask about a supervised pulmonary rehab or physio programme.', costHint: 'a referral or a clinic fee' },
  },
  'gut-health': {
    cheap: { title: 'Add a live yoghurt or kefir to today.', costHint: 'a few pounds' },
    premium: { title: 'See a dietitian about a structured gut plan.', costHint: 'a professional consultation' },
  },
  hydration: {
    cheap: { title: 'Buy a marked bottle so the target is visible all day.', costHint: 'a few pounds' },
    premium: { title: 'Fit a filter tap or jug so good water is the default.', costHint: 'a one-off appliance' },
  },
  'eye-care': {
    cheap: { title: 'Book the routine eye test you are due.', costHint: 'free in some countries, otherwise a modest fee' },
    premium: { title: 'Book a fuller retinal check with an optometrist.', costHint: 'an enhanced appointment' },
  },
};

const BY_TYPE: Record<PlanItemType, TierCopy> = {
  diet: {
    cheap: { title: 'Spend a little on the ingredient that makes this easy.', costHint: 'a few pounds' },
    premium: { title: 'Have the ingredients delivered so the choice is made for you.', costHint: 'a delivery or subscription' },
  },
  exercise: {
    cheap: { title: 'Buy one cheap piece of kit that removes the excuse.', costHint: 'a few pounds' },
    premium: { title: 'Book a class or a coached session.', costHint: 'class or coaching pricing' },
  },
  habit: {
    cheap: { title: 'Spend a little on the thing that makes this stick.', costHint: 'a few pounds' },
    premium: { title: 'Bring in a professional or a structured programme.', costHint: 'a professional session' },
  },
};

function copyFor(item: PlanItem): TierCopy {
  for (const tag of item.matchedTags) {
    const found = BY_TAG[tag];
    if (found) return found;
  }
  return BY_TYPE[item.type];
}

/** Attaches the three spend options to a resolved plan item. */
export function withTiers(item: PlanItem): TieredAction {
  const copy = copyFor(item);
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    why: item.why,
    howTo: [...item.howTo],
    benefit: item.benefit,
    target: item.target,
    safetyNote: item.safetyNote,
    relatedConditions: item.relatedConditions,
    matchedTags: item.matchedTags,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    options: [
      { tier: 'free', label: 'Free', title: item.target, costHint: 'costs nothing' },
      { tier: 'cheap', label: 'Cheap', title: copy.cheap.title, costHint: copy.cheap.costHint },
      { tier: 'premium', label: 'Premium', title: copy.premium.title, costHint: copy.premium.costHint },
    ],
  };
}

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}
