import type { PlanTag } from './condition-types';

/**
 * The prevention guidance library.
 *
 * This is a static, curated table. There is no LLM call, no network
 * request and nothing asynchronous anywhere in resolving a plan: the same
 * selections and the same day always produce the same plan, on the server
 * and in the browser alike.
 *
 * Items are matched to people by tag, never by condition. That is what
 * lets 117 catalog conditions share one body of guidance instead of
 * needing bespoke copy each, and it is why adding a condition to the
 * catalog is a data change rather than a content project.
 *
 * Everything here is general lifestyle guidance of the kind found in
 * public-health material. None of it is medical advice, none of it is
 * personalised to a diagnosis, and nothing about a family history changes
 * what the guidance says. The UI states this plainly.
 */

export type PlanItemType = 'diet' | 'exercise' | 'habit';

export interface PlanContent {
  /** Stable key. Referenced in no database column today, but keep it stable. */
  id: string;
  type: PlanItemType;
  /** The one line shown on the card. Imperative, specific, doable today. */
  title: string;
  /** What to actually do, expanded. */
  description: string;
  /** Why this is worth doing at all. */
  why: string;
  /** Concrete steps. Rendered as a list in the detail view. */
  howTo: readonly string[];
  /**
   * What it may support. Deliberately hedged language: these are
   * associations from population-level guidance, not promises to an
   * individual.
   */
  benefit: string;
  /** Something you could actually check by the end of the day. */
  target: string;
  /** Shown prominently when present. */
  safetyNote?: string;
  tags: readonly PlanTag[];
  sourceName: string;
  sourceUrl: string;
}

const WHO = 'World Health Organization';
const NHS = 'NHS';
const CDC = 'CDC';
const MEDLINEPLUS = 'MedlinePlus (NIH)';
const NIH = 'National Institutes of Health';

const WHO_ACTIVITY = 'https://www.who.int/news-room/fact-sheets/detail/physical-activity';
const WHO_DIET = 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet';
const WHO_SALT = 'https://www.who.int/news-room/fact-sheets/detail/salt-reduction';
const WHO_ALCOHOL = 'https://www.who.int/news-room/fact-sheets/detail/alcohol';
const WHO_TOBACCO = 'https://www.who.int/news-room/fact-sheets/detail/tobacco';
const WHO_MENTAL = 'https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response';

export const PLAN_CONTENT: readonly PlanContent[] = [
  // ===== Diet ==============================================================
  {
    id: 'diet_vegetables',
    type: 'diet',
    title: 'Make half your largest plate vegetables.',
    description:
      'At whichever meal is biggest today, fill half the plate with vegetables or salad before anything else goes on it.',
    why: 'Filling the plate in that order changes the proportions without requiring you to count, weigh or give anything up. Most people eat more vegetables and slightly less of everything else without noticing.',
    howTo: [
      'Serve the vegetables first, onto the empty plate.',
      'Add protein to a quarter of what is left.',
      'Add the starch last, to the final quarter.',
      'Frozen counts. Tinned counts. It does not have to be fresh.',
    ],
    benefit:
      'Diets higher in vegetables are associated with lower rates of heart disease, stroke and several cancers in population studies.',
    target: 'One meal today where vegetables covered half the plate.',
    tags: ['diet-quality', 'weight', 'diet-fibre'],
    sourceName: WHO,
    sourceUrl: WHO_DIET,
  },
  {
    id: 'diet_fibre_target',
    type: 'diet',
    title: 'Add a high-fibre food to every meal.',
    description:
      'Beans, lentils, wholegrains, fruit with the skin on, nuts. One addition per meal, not a whole new diet.',
    why: 'Most people eat around half the fibre recommended. Fibre is one of the few dietary changes with consistent evidence across bowel health, cholesterol and blood sugar at once.',
    howTo: [
      'Breakfast: swap to a wholegrain cereal or add fruit.',
      'Lunch: add a tin of beans, chickpeas or lentils.',
      'Dinner: keep the skins on potatoes, or choose wholegrain rice or pasta.',
      'Increase gradually and drink more water, or you will feel bloated.',
    ],
    benefit:
      'Higher fibre intake is associated with lower risk of bowel cancer, heart disease and type 2 diabetes.',
    target: 'Fibre added at three separate meals.',
    safetyNote:
      'If you have an inflammatory bowel condition or a stricture, increase fibre only on your clinician’s advice. It is not universally good for every gut.',
    tags: ['diet-fibre', 'gut-health', 'diet-quality'],
    sourceName: NHS,
    sourceUrl: 'https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/',
  },
  {
    id: 'diet_salt',
    type: 'diet',
    title: 'Keep added salt under one teaspoon all day.',
    description:
      'That is roughly the 5g daily maximum in most national guidance. The salt you add at the table is the easy part; the salt already in bread, sauces and processed meat is most of it.',
    why: 'Salt intake tracks closely with blood pressure at a population level, and blood pressure is the single largest modifiable contributor to stroke.',
    howTo: [
      'Taste before you salt. Often it does not need it.',
      'Check the label on one packaged item: anything over 1.5g salt per 100g is high.',
      'Use herbs, lemon, pepper, garlic or vinegar for flavour instead.',
      'Cook one meal from scratch so you control the amount.',
    ],
    benefit:
      'Reducing salt intake is associated with lower blood pressure, and lower blood pressure with reduced stroke and heart disease risk.',
    target: 'One packaged food label read, and no salt added at the table.',
    tags: ['diet-salt', 'diet-quality'],
    sourceName: WHO,
    sourceUrl: WHO_SALT,
  },
  {
    id: 'diet_sugary_drinks',
    type: 'diet',
    title: 'Drink no sugary drinks today.',
    description:
      'Fizzy drinks, energy drinks, sweetened coffees, and fruit juice too. Water, unsweetened tea or coffee instead.',
    why: 'Liquid sugar arrives fast and does not make you feel full, so it adds to the day rather than replacing anything. It is one of the easiest single changes to make.',
    howTo: [
      'Fill a bottle with water in the morning and keep it where you work.',
      'If you want fizz, try sparkling water with a slice of lemon.',
      'If you take sugar in tea or coffee, halve it rather than stopping.',
      'Juice counts. Smoothies mostly count. Whole fruit does not.',
    ],
    benefit:
      'Lower sugary-drink intake is associated with lower risk of weight gain, type 2 diabetes and tooth decay.',
    target: 'Zero sugary drinks, from waking to sleeping.',
    tags: ['diet-sugar', 'weight', 'hydration'],
    sourceName: WHO,
    sourceUrl: WHO_DIET,
  },
  {
    id: 'diet_swap_protein',
    type: 'diet',
    title: 'Swap one portion of red or processed meat.',
    description:
      'Replace it with fish, beans, lentils, eggs or tofu at one meal today. One meal, not every meal.',
    why: 'Processed meat in particular is consistently associated with higher bowel cancer and heart disease risk. A single regular swap is a change you can actually sustain.',
    howTo: [
      'Pick the meal where you would miss it least.',
      'Tinned fish, tinned beans and eggs are the cheapest swaps.',
      'Keep the seasoning and the method identical, only change the protein.',
    ],
    benefit:
      'Lower processed-meat intake is associated with reduced bowel cancer and cardiovascular risk.',
    target: 'One meal today with no red or processed meat in it.',
    tags: ['diet-quality', 'diet-fibre'],
    sourceName: WHO,
    sourceUrl: WHO_DIET,
  },
  {
    id: 'diet_meal_order',
    type: 'diet',
    title: 'Eat protein and vegetables before the carbohydrate.',
    description:
      'Same meal, same food, different order: vegetables and protein first, the bread, rice, pasta or potato last.',
    why: 'Eating the starch last tends to blunt how sharply blood sugar rises after the meal. It costs nothing and changes nothing about what you cooked.',
    howTo: [
      'Start with the salad or vegetables on the plate.',
      'Move to the protein.',
      'Finish with the starch.',
      'It works best when there is a few minutes between, not seconds.',
    ],
    benefit:
      'Meal sequencing is associated with smaller post-meal blood glucose rises in people with and without diabetes.',
    target: 'Two meals today eaten in that order.',
    tags: ['diet-sugar', 'diet-quality', 'weight'],
    sourceName: MEDLINEPLUS,
    sourceUrl: 'https://medlineplus.gov/diabeticdiet.html',
  },
  {
    id: 'diet_calcium',
    type: 'diet',
    title: 'Get one good calcium source in today.',
    description:
      'Dairy, fortified plant milk, tofu set with calcium, tinned fish with the bones in, or leafy greens like kale and pak choi.',
    why: 'Bone is living tissue that is constantly rebuilt, and it needs the raw material. Most of the bone you will ever have is laid down early, but what you keep depends on what you do now.',
    howTo: [
      'Check the label: fortified plant milks vary enormously.',
      'A tin of sardines is one of the densest sources there is.',
      'Pair it with daylight, which is where most vitamin D comes from.',
    ],
    benefit:
      'Adequate calcium and vitamin D intake is associated with better preserved bone density.',
    target: 'One deliberate calcium source eaten, not just assumed.',
    tags: ['bone-strength', 'diet-quality'],
    sourceName: NIH,
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Calcium-Consumer/',
  },
  {
    id: 'diet_hydration',
    type: 'diet',
    title: 'Drink water through the day, not all at once.',
    description:
      'Aim for pale straw-coloured urine. That is a better guide than any fixed number of glasses.',
    why: 'Steady fluid intake is the single best evidenced way to reduce the recurrence of kidney stones, and it quietly affects concentration and headaches too.',
    howTo: [
      'Have a glass with each meal and one between each.',
      'Keep a filled bottle in sight; visibility does most of the work.',
      'Increase it in hot weather and around exercise.',
    ],
    benefit:
      'Higher fluid intake is associated with substantially lower kidney stone recurrence.',
    target: 'Urine pale rather than dark by the end of the day.',
    safetyNote:
      'If you have heart failure or kidney disease you may have been given a fluid limit. That limit wins over this.',
    tags: ['hydration'],
    sourceName: MEDLINEPLUS,
    sourceUrl: 'https://medlineplus.gov/kidneystones.html',
  },
  {
    id: 'diet_gut_variety',
    type: 'diet',
    title: 'Eat five different plant foods today.',
    description:
      'Five distinct ones, not five portions of the same thing. Herbs, spices, nuts and seeds all count.',
    why: 'Variety of plants, more than quantity of any single one, is what the gut microbiome research keeps pointing at. It is also an easier target to hit than a weight in grams.',
    howTo: [
      'Count them as you go; most people guess high.',
      'A mixed bag of frozen vegetables is several at once.',
      'Add a spoon of seeds or a handful of nuts to something.',
    ],
    benefit:
      'Greater plant diversity is associated with a more varied gut microbiome and better markers of digestive health.',
    target: 'Five distinct plant foods, counted honestly.',
    tags: ['gut-health', 'diet-quality', 'diet-fibre'],
    sourceName: NHS,
    sourceUrl: 'https://www.nhs.uk/live-well/eat-well/digestive-health/good-foods-to-help-your-digestion/',
  },
  {
    id: 'diet_cook_one_meal',
    type: 'diet',
    title: 'Cook one meal from whole ingredients.',
    description:
      'One meal, start to finish, from things that did not arrive already assembled.',
    why: 'It is the most reliable way to control salt, sugar and portion size at once, and it is a skill rather than a restriction, so it compounds.',
    howTo: [
      'Pick the simplest meal of your day, not the most ambitious.',
      'Four or five ingredients is plenty.',
      'Make twice as much and keep half for tomorrow.',
    ],
    benefit:
      'Home-prepared meals are associated with lower intake of salt, free sugars and total energy.',
    target: 'One meal cooked rather than bought ready-made.',
    tags: ['diet-quality', 'diet-salt', 'diet-sugar', 'weight'],
    sourceName: WHO,
    sourceUrl: WHO_DIET,
  },
  {
    id: 'diet_portion_awareness',
    type: 'diet',
    title: 'Eat to comfortably satisfied, not full.',
    description:
      'Stop at the point where you could eat more but do not need to. Put the cutlery down between mouthfuls to notice where that point is.',
    why: 'Fullness signals arrive late. Eating slightly slower is one of the few portion strategies that does not require measuring anything.',
    howTo: [
      'Put the fork down between mouthfuls at one meal.',
      'Serve from the kitchen rather than putting dishes on the table.',
      'Wait ten minutes before a second helping.',
    ],
    benefit:
      'Slower eating and smaller served portions are associated with lower total intake without increased hunger.',
    target: 'One meal eaten without a second helping.',
    safetyNote:
      'Skip this one if you have a history of disordered eating. Preventah does not set weight targets, and nothing here should turn into counting.',
    tags: ['weight', 'diet-quality'],
    sourceName: NHS,
    sourceUrl: 'https://www.nhs.uk/live-well/healthy-weight/',
  },
  {
    id: 'diet_alcohol_free_day',
    type: 'diet',
    title: 'Make today an alcohol-free day.',
    description:
      'A deliberate zero, planned in advance rather than one that happens by accident.',
    why: 'There is no level of alcohol established as risk-free, and deliberate alcohol-free days are more effective than an intention to cut down in general.',
    howTo: [
      'Decide before the time of day you would normally drink.',
      'Have the alternative physically in the house.',
      'Tell someone, if that helps you hold to it.',
    ],
    benefit:
      'Lower alcohol intake is associated with reduced risk of liver disease, several cancers, high blood pressure and atrial fibrillation.',
    target: 'Zero alcoholic drinks today.',
    safetyNote:
      'If you drink heavily every day, stopping abruptly can be dangerous. Talk to a clinician before cutting alcohol out rather than down.',
    tags: ['alcohol'],
    sourceName: WHO,
    sourceUrl: WHO_ALCOHOL,
  },

  // ===== Exercise ==========================================================
  {
    id: 'ex_brisk_walk',
    type: 'exercise',
    title: 'Walk briskly for 30 minutes.',
    description:
      'Brisk means fast enough that talking takes noticeable effort but singing is out of the question. It does not have to be in one block.',
    why: 'Thirty minutes on most days is the backbone of every national activity guideline, and walking is the version of it almost everyone can actually do.',
    howTo: [
      'Three ten-minute walks count the same as one thirty.',
      'Pace it so you could still hold a conversation, just.',
      'Attach it to something you already do: a commute, a call, the shops.',
    ],
    benefit:
      'Regular moderate activity is associated with lower risk of heart disease, stroke, type 2 diabetes, several cancers and depression.',
    target: '30 minutes of brisk walking, in as many pieces as you like.',
    tags: ['activity', 'weight'],
    sourceName: WHO,
    sourceUrl: WHO_ACTIVITY,
  },
  {
    id: 'ex_post_meal_walk',
    type: 'exercise',
    title: 'Walk for 15 minutes after your largest meal.',
    description:
      'Not a workout. A walk, within about an hour of finishing eating.',
    why: 'Light movement after eating uses some of the glucose from the meal directly, which blunts the peak. It is one of the highest-return-for-effort habits there is.',
    howTo: [
      'Start within an hour of finishing.',
      'Easy pace is fine; this is not about intensity.',
      'Even ten minutes does something. Do not skip it because you cannot do fifteen.',
    ],
    benefit:
      'Walking after meals is associated with meaningfully lower post-meal blood glucose.',
    target: 'A walk of 15 minutes or more after one meal.',
    tags: ['activity', 'diet-sugar', 'weight'],
    sourceName: CDC,
    sourceUrl: 'https://www.cdc.gov/diabetes/prevention-type-2/index.html',
  },
  {
    id: 'ex_strength',
    type: 'exercise',
    title: 'Do a short strength session.',
    description:
      'Something for legs, something pushing, something pulling. Two sets each. Bodyweight is fine.',
    why: 'Guidelines ask for muscle-strengthening work twice a week and almost nobody does it. It is what protects muscle mass, bone density and balance as you age.',
    howTo: [
      'Legs: sit-to-stands from a chair, 10 to 15 reps.',
      'Push: press-ups, against a wall or the floor, whichever you can control.',
      'Pull: rows with a resistance band, a bag, or anything with a handle.',
      'Stop two reps before you could not do another.',
    ],
    benefit:
      'Muscle-strengthening activity is associated with preserved bone density, better glucose control and lower all-cause mortality.',
    target: 'Two sets each of a leg, a push and a pull movement.',
    safetyNote:
      'Build up gradually if you are new to this, and stop at pain rather than working through it.',
    tags: ['activity', 'bone-strength', 'weight'],
    sourceName: WHO,
    sourceUrl: WHO_ACTIVITY,
  },
  {
    id: 'ex_weight_bearing',
    type: 'exercise',
    title: 'Do 20 minutes of weight-bearing movement.',
    description:
      'Walking, stair climbing, dancing, racket sport. Anything where your legs carry your weight against gravity.',
    why: 'Bone responds to being loaded and to nothing else. Swimming and cycling are excellent for the heart but do almost nothing for bone density.',
    howTo: [
      'Stairs are the most accessible version of this.',
      'Vary the ground if you can; uneven surfaces recruit more.',
      'Impact matters more than duration for bone, within reason.',
    ],
    benefit:
      'Weight-bearing exercise is associated with better preserved bone mineral density.',
    target: '20 minutes on your feet, carrying your own weight.',
    safetyNote:
      'If you already have low bone density or a spinal fracture, ask a physiotherapist which impact is safe for you before adding any.',
    tags: ['bone-strength', 'activity'],
    sourceName: NIH,
    sourceUrl: 'https://www.niams.nih.gov/health-topics/exercise-your-bone-health',
  },
  {
    id: 'ex_break_sitting',
    type: 'exercise',
    title: 'Break up every hour of sitting.',
    description:
      'Stand and move for two or three minutes at the top of each hour you spend seated.',
    why: 'Long unbroken sitting has effects that a single daily workout does not fully undo. The interruptions matter separately from the exercise.',
    howTo: [
      'Set a repeating hourly reminder for today.',
      'Walk to fill a glass of water; it stacks two habits.',
      'Standing up and sitting down five times counts.',
    ],
    benefit:
      'Interrupting prolonged sitting is associated with better glucose and blood pressure profiles, independently of total exercise.',
    target: 'Every seated hour today interrupted at least once.',
    tags: ['activity', 'weight', 'diet-sugar'],
    sourceName: WHO,
    sourceUrl: WHO_ACTIVITY,
  },
  {
    id: 'ex_balance',
    type: 'exercise',
    title: 'Practise balance for five minutes.',
    description:
      'Stand on one leg for 30 seconds each side, twice. Hold a worktop with one finger if you need to.',
    why: 'Falls, not fragile bone alone, are what turn low bone density into a fracture. Balance is trainable at any age and declines silently if it is not.',
    howTo: [
      'Stand near a solid surface you can grab.',
      '30 seconds on one leg, then the other. Twice through.',
      'Progress by using fewer fingers on the worktop, not by going straight to nothing.',
      'Brushing your teeth is a good anchor for it.',
    ],
    benefit:
      'Balance training is associated with meaningfully reduced fall rates in older adults.',
    target: 'Four 30-second holds completed.',
    tags: ['bone-strength', 'activity'],
    sourceName: NHS,
    sourceUrl: 'https://www.nhs.uk/live-well/exercise/balance-exercises/',
  },
  {
    id: 'ex_intervals',
    type: 'exercise',
    title: 'Do 20 minutes of interval walking.',
    description:
      'One minute quick, two minutes easy, repeated. Adjust "quick" to whatever is quick for you.',
    why: 'Alternating effort gets more cardiorespiratory benefit into less time than a steady walk, and the easy portions make the hard ones sustainable.',
    howTo: [
      'Warm up for three minutes first.',
      'Quick should feel like a 7 out of 10, not a sprint.',
      'If you cannot complete the easy minute comfortably, the quick one was too fast.',
    ],
    benefit:
      'Higher cardiorespiratory fitness is associated with lower cardiovascular and all-cause mortality.',
    target: 'Six quick intervals completed.',
    safetyNote:
      'If you have a known heart condition or chest symptoms on exertion, check with your clinician before adding intensity.',
    tags: ['activity', 'weight'],
    sourceName: WHO,
    sourceUrl: WHO_ACTIVITY,
  },
  {
    id: 'ex_breathing_capacity',
    type: 'exercise',
    title: 'Do ten minutes of paced breathing work.',
    description:
      'Slow nasal breathing with a longer out-breath than in-breath, sitting upright.',
    why: 'Breathing exercises help with breathlessness management and with the anxiety that often travels alongside it. They are also the only item here you can do on a bad day.',
    howTo: [
      'Sit upright, shoulders down.',
      'In through the nose for a count of four.',
      'Out, gently, for a count of six. Do not force it.',
      'Ten minutes, or stop earlier if you feel light-headed.',
    ],
    benefit:
      'Breathing retraining is associated with reduced breathlessness and improved quality of life in chronic respiratory conditions.',
    target: 'Ten minutes of paced breathing completed.',
    safetyNote:
      'Stop if you feel dizzy. This supports a condition; it does not treat one, and it is not a substitute for prescribed inhalers.',
    tags: ['breathing', 'stress'],
    sourceName: NHS,
    sourceUrl: 'https://www.nhs.uk/conditions/chronic-obstructive-pulmonary-disease-copd/living-with/',
  },
  {
    id: 'ex_enjoyable',
    type: 'exercise',
    title: 'Do 30 minutes of something you actually like.',
    description:
      'Dancing, gardening, swimming, football, cycling. The activity you will repeat beats the activity that is theoretically optimal.',
    why: 'Adherence is the whole game. The best exercise programme is the one still happening in six months.',
    howTo: [
      'Pick something you would do even if it were not good for you.',
      'Put it in the calendar rather than leaving it to willpower.',
      'Doing it with someone roughly doubles the odds you keep going.',
    ],
    benefit:
      'Any regular activity is associated with lower cardiovascular risk and improved mood; enjoyment predicts whether it continues.',
    target: '30 minutes of an activity you would choose again.',
    tags: ['activity', 'mental-wellbeing'],
    sourceName: WHO,
    sourceUrl: WHO_ACTIVITY,
  },
  {
    id: 'ex_daylight_walk',
    type: 'exercise',
    title: 'Take a 20-minute walk outdoors in daylight.',
    description:
      'Outdoors specifically, and in daylight specifically, even if it is grey.',
    why: 'Daylight early in the day anchors your body clock, which affects sleep that night. Outdoor time is also where most vitamin D comes from, and time outdoors in childhood is protective against short-sightedness.',
    howTo: [
      'Earlier is better for the body-clock effect.',
      'Overcast daylight is still many times brighter than indoor lighting.',
      'Leave the destination open; this is not an errand.',
    ],
    benefit:
      'Daylight exposure is associated with better sleep timing and mood; outdoor time in childhood with lower myopia progression.',
    target: '20 minutes outdoors while it is light.',
    tags: ['activity', 'sleep', 'mental-wellbeing', 'eye-care'],
    sourceName: MEDLINEPLUS,
    sourceUrl: 'https://medlineplus.gov/healthysleep.html',
  },

  // ===== Habit =============================================================
  {
    id: 'habit_sleep_window',
    type: 'habit',
    title: 'Go to bed at a consistent time tonight.',
    description:
      'Same time as yesterday, within about half an hour. The consistency matters more than the hour itself.',
    why: 'A regular sleep window is more achievable than a target duration and tends to produce the duration anyway. Short sleep raises blood pressure and worsens insulin resistance measurably within days.',
    howTo: [
      'Set an alarm for going to bed, not only for waking.',
      'Dim the lights an hour before.',
      'Keep the wake time fixed even at weekends; that is the anchor.',
    ],
    benefit:
      'Adequate, regular sleep is associated with lower blood pressure, better glucose control and better mental health.',
    target: 'In bed within 30 minutes of the same time as yesterday.',
    tags: ['sleep', 'stress', 'mental-wellbeing'],
    sourceName: MEDLINEPLUS,
    sourceUrl: 'https://medlineplus.gov/healthysleep.html',
  },
  {
    id: 'habit_measure_bp',
    type: 'habit',
    title: 'Measure your blood pressure and record it.',
    description:
      'If you have a cuff, take a reading after sitting quietly for five minutes, and write the number down.',
    why: 'High blood pressure has no symptoms until it has caused damage. A number you have written down is worth more to a clinician than any impression of how you feel.',
    howTo: [
      'Sit still for five minutes first, feet flat, back supported.',
      'Arm resting at heart height, cuff on bare skin.',
      'Take two readings a minute apart and record the second.',
      'Record it in Preventah so you can see the trend.',
    ],
    benefit:
      'Home blood pressure monitoring is associated with better blood pressure control than clinic readings alone.',
    target: 'One reading taken and written down.',
    safetyNote:
      'A single high reading is not a diagnosis. A pattern of them is a reason to see a clinician, not to self-treat.',
    tags: ['screening'],
    sourceName: CDC,
    sourceUrl: 'https://www.cdc.gov/high-blood-pressure/measure/index.html',
  },
  {
    id: 'habit_tobacco_log',
    type: 'habit',
    title: 'Log anything you smoked or vaped, honestly.',
    description:
      'Not a judgement, a count. Write down the number without editing it.',
    why: 'Stopping smoking is the single largest change available for almost every condition in this catalog. Accurate awareness of the current amount is where every successful attempt starts.',
    howTo: [
      'Count today, without changing anything yet.',
      'Note the time of each one; the pattern is more useful than the total.',
      'When you are ready, national stop-smoking services roughly triple the success rate over willpower alone.',
    ],
    benefit:
      'Stopping smoking is associated with reduced risk across cardiovascular disease, at least a dozen cancers, COPD and macular degeneration.',
    target: 'An honest count written down.',
    tags: ['tobacco'],
    sourceName: WHO,
    sourceUrl: WHO_TOBACCO,
  },
  {
    id: 'habit_slow_breathing',
    type: 'habit',
    title: 'Do five minutes of slow breathing.',
    description:
      'Around six breaths a minute: in for four, out for six. Anywhere, sitting down.',
    why: 'It is the shortest evidence-supported intervention for acute stress there is, and unlike most stress advice it does not require any change to your circumstances.',
    howTo: [
      'Set a five-minute timer so you are not watching the clock.',
      'In through the nose for four, out through the mouth for six.',
      'Your attention will wander. Bringing it back is the exercise.',
    ],
    benefit:
      'Slow-paced breathing is associated with short-term reductions in blood pressure and subjective stress.',
    target: 'Five uninterrupted minutes.',
    tags: ['stress', 'breathing', 'mental-wellbeing'],
    sourceName: WHO,
    sourceUrl: WHO_MENTAL,
  },
  {
    id: 'habit_screening_check',
    type: 'habit',
    title: 'Check which screenings you are due for.',
    description:
      'Look up what your national health service offers for your age and sex, and note anything you have missed.',
    why: 'Screening finds things while they are still easy to deal with. A family history sometimes means starting earlier or going more often than the default, which is a conversation worth having.',
    howTo: [
      'Check bowel, breast, cervical and, where offered, lung and aortic screening.',
      'Note the date of your last one for each.',
      'If a family history might change your schedule, write that down for your clinician.',
    ],
    benefit:
      'Participation in screening programmes is associated with earlier-stage diagnosis and lower mortality for several cancers.',
    target: 'One screening you are due for identified, or confirmation that you are up to date.',
    tags: ['screening'],
    sourceName: CDC,
    sourceUrl: 'https://www.cdc.gov/cancer/prevention/screening.html',
  },
  {
    id: 'habit_family_history_note',
    type: 'habit',
    title: 'Write your family history down once, clearly.',
    description:
      'Which conditions, which relatives, roughly what age. One page you can hand to a clinician.',
    why: 'Almost nobody can recall this accurately under the time pressure of an appointment. A clinician can only act on a family history they actually hear.',
    howTo: [
      'Parents, siblings, grandparents. That is usually enough.',
      'Approximate ages at diagnosis matter more than exact ones.',
      'Ask a relative to fill the gaps while you can.',
      'Preventah keeps only the short condition codes you ticked, never the detail. Keep the page yourself.',
    ],
    benefit:
      'A documented family history is associated with more appropriate screening and referral decisions.',
    target: 'One page written, stored somewhere you will find it.',
    tags: ['screening', 'mental-wellbeing'],
    sourceName: CDC,
    sourceUrl: 'https://www.cdc.gov/genomics-and-health/family-health-history/index.html',
  },
  {
    id: 'habit_sun_protection',
    type: 'habit',
    title: 'Protect your skin if you will be outside.',
    description:
      'Shade in the middle of the day, a shirt, and sunscreen on what is left uncovered.',
    why: 'Sun damage accumulates and does not undo itself. Shade and clothing do more of the work than sunscreen does, and last longer.',
    howTo: [
      'Seek shade between roughly 11am and 3pm.',
      'Cover up: sleeves, a hat, sunglasses that block UV.',
      'Sunscreen on the rest, reapplied after swimming or sweating.',
      'Never use a sunbed.',
    ],
    benefit:
      'Sun protection is associated with reduced risk of melanoma and non-melanoma skin cancer, and with slower skin ageing.',
    target: 'Shade, clothing and sunscreen all used if you went out.',
    tags: ['sun-safety', 'eye-care'],
    sourceName: WHO,
    sourceUrl: 'https://www.who.int/news-room/questions-and-answers/item/radiation-sun-protection',
  },
  {
    id: 'habit_eye_test',
    type: 'habit',
    title: 'Check when you last had an eye test.',
    description:
      'Not a vision check at home. A proper sight test with an optometrist, which looks at pressure and the back of the eye too.',
    why: 'Glaucoma is painless and takes peripheral vision first, which the brain fills in. By the time it is noticeable, the loss is permanent. A test is the only way to catch it early.',
    howTo: [
      'Two years is the usual interval; more often with a family history or diabetes.',
      'Say if glaucoma, macular degeneration or diabetes runs in your family.',
      'Book it now rather than noting that you should.',
    ],
    benefit:
      'Regular eye examination is associated with earlier detection of glaucoma and diabetic retinopathy, when treatment still preserves sight.',
    target: 'Date of last test established, and a new one booked if overdue.',
    tags: ['eye-care', 'screening'],
    sourceName: MEDLINEPLUS,
    sourceUrl: 'https://medlineplus.gov/eyecare.html',
  },
  {
    id: 'habit_alcohol_track',
    type: 'habit',
    title: 'Write down everything you drank today.',
    description:
      'Every drink, with its actual size. Home measures are usually larger than pub ones.',
    why: 'Self-estimated alcohol intake is reliably lower than recorded intake, in everyone, not just heavy drinkers. Writing it down is the only way to know where you stand.',
    howTo: [
      'Record as you go, not from memory at bedtime.',
      'Note the size: a large glass of wine can be a third of a bottle.',
      'Compare the week against your national low-risk guideline.',
    ],
    benefit:
      'Self-monitoring is associated with reduced consumption, independently of any other intervention.',
    target: 'A complete written record of today.',
    tags: ['alcohol', 'mental-wellbeing'],
    sourceName: WHO,
    sourceUrl: WHO_ALCOHOL,
  },
  {
    id: 'habit_waist',
    type: 'habit',
    title: 'Measure your waist and record it.',
    description:
      'Around the middle, level with your navel, tape snug but not pulled tight. Breathe out normally first.',
    why: 'Waist measurement tracks the fat around the organs better than weight does, and it moves when weight does not. It is a more useful number to follow over months.',
    howTo: [
      'Same time of day each time, ideally in the morning.',
      'Do not pull the tape tight; it should sit without indenting.',
      'Record it in Preventah so you can see the trend rather than the reading.',
    ],
    benefit:
      'Central adiposity is associated with cardiovascular and type 2 diabetes risk, more closely than body weight alone.',
    target: 'One measurement taken and recorded.',
    safetyNote:
      'If tracking body measurements is difficult for you, skip this one. Preventah does not require it and sets no targets.',
    tags: ['weight', 'screening'],
    sourceName: NHS,
    sourceUrl: 'https://www.nhs.uk/live-well/healthy-weight/',
  },
  {
    id: 'habit_stressor_note',
    type: 'habit',
    title: 'Name one stressor, and one thing you control about it.',
    description:
      'Write both down. The second half is what makes this useful rather than a list of worries.',
    why: 'Splitting a stressor into the part you can act on and the part you cannot is the core move in most structured stress interventions, and it works on paper as well as in a session.',
    howTo: [
      'Write the stressor in one plain sentence.',
      'Underneath, write one thing within your control, however small.',
      'Do that one thing today if it takes under five minutes.',
    ],
    benefit:
      'Structured problem-focused coping is associated with lower perceived stress and better mood.',
    target: 'Two sentences written.',
    tags: ['stress', 'mental-wellbeing'],
    sourceName: WHO,
    sourceUrl: WHO_MENTAL,
  },
  {
    id: 'habit_connect',
    type: 'habit',
    title: 'Have one real conversation today.',
    description:
      'Voice or in person, not messages. Ten minutes with someone who knows you.',
    why: 'Social connection shows up in the mortality data at a strength comparable to the classic physical risk factors, and it is the one most likely to be quietly dropped when things get busy.',
    howTo: [
      'Call rather than text.',
      'Ask one question and then actually listen to the answer.',
      'If today is hard, sending one message to arrange it counts.',
    ],
    benefit:
      'Stronger social connection is associated with lower all-cause mortality and lower rates of depression.',
    target: 'One conversation, by voice or in person.',
    tags: ['mental-wellbeing', 'stress'],
    sourceName: WHO,
    sourceUrl: WHO_MENTAL,
  },
  {
    id: 'habit_oral_care',
    type: 'habit',
    title: 'Clean between your teeth, not just across them.',
    description:
      'Floss or interdental brushes, once, properly. Brushing misses the surfaces where gum disease starts.',
    why: 'Gum disease is common, largely preventable, and shares risk factors and possibly mechanisms with heart disease and diabetes. Brushing alone does not reach the places that matter.',
    howTo: [
      'Interdental brushes are easier to use well than floss for most people.',
      'Once a day is enough, at whichever time you will actually do it.',
      'Bleeding at first usually means inflammation, not damage. It settles.',
    ],
    benefit:
      'Interdental cleaning is associated with reduced gum inflammation and lower rates of periodontal disease.',
    target: 'Cleaned between every tooth once today.',
    tags: ['screening', 'diet-sugar'],
    sourceName: NHS,
    sourceUrl: 'https://www.nhs.uk/live-well/healthy-teeth-and-gums/how-to-keep-your-teeth-clean/',
  },
  {
    id: 'habit_home_safety',
    type: 'habit',
    title: 'Remove one trip hazard from your home.',
    description:
      'Loose rug, trailing cable, dark stairway, cluttered hallway. Pick one and deal with it today.',
    why: 'A fracture usually needs two things: fragile bone and a fall. Bone density takes months to influence. A loose rug takes about a minute.',
    howTo: [
      'Walk your usual night-time route from bed to bathroom and look at the floor.',
      'Fix the worst thing you find rather than surveying everything.',
      'A night light on the landing is one of the highest-value changes there is.',
    ],
    benefit:
      'Home hazard reduction is associated with lower fall rates, particularly in people at higher risk.',
    target: 'One hazard actually removed, not just noticed.',
    tags: ['bone-strength', 'screening'],
    sourceName: CDC,
    sourceUrl: 'https://www.cdc.gov/falls/prevention/index.html',
  },
  {
    id: 'habit_plan_tomorrow',
    type: 'habit',
    title: 'Decide one thing about tomorrow tonight.',
    description:
      'Tomorrow’s lunch, or where the exercise goes in the day. One decision, made now.',
    why: 'Decisions made in advance are made by a different version of you than the one who is tired, hungry and short of time. That is most of what separates a plan that holds from one that does not.',
    howTo: [
      'Pick the decision you most often get wrong under pressure.',
      'Make it concrete: what, and when, not "eat better".',
      'Set out whatever it needs tonight.',
    ],
    benefit:
      'Implementation intentions, deciding in advance what you will do and when, are associated with substantially higher follow-through.',
    target: 'One specific decision made and written down.',
    tags: ['mental-wellbeing', 'weight', 'activity'],
    sourceName: NHS,
    sourceUrl: 'https://www.nhs.uk/live-well/',
  },
  {
    id: 'habit_medication_timing',
    type: 'habit',
    title: 'Take any prescribed medication at the same time as yesterday.',
    description:
      'Same time, every day. Attach it to something you already do without thinking.',
    why: 'Most prescribed medicines for long-term conditions work through steady levels rather than individual doses. Missed and irregular doses are the most common reason a treatment appears not to be working.',
    howTo: [
      'Anchor it to a fixed event: kettle on, teeth brushed.',
      'A weekly pill box tells you at a glance whether you took it.',
      'If you keep forgetting, say so at your next appointment rather than working around it.',
    ],
    benefit:
      'Better medication adherence is associated with better control of blood pressure, glucose and cholesterol.',
    target: 'Taken at the same time as yesterday.',
    safetyNote:
      'Never change a dose or stop a medicine based on anything in this app. That is a conversation with your prescriber.',
    tags: ['screening'],
    sourceName: MEDLINEPLUS,
    sourceUrl: 'https://medlineplus.gov/managingmedicines.html',
  },
  {
    id: 'habit_water_visible',
    type: 'habit',
    title: 'Put a filled water bottle where you will see it.',
    description:
      'On the desk, in the car, by the bed. Visibility does most of the work.',
    why: 'Hydration is one of the few habits where the environment matters more than the intention. People drink what is in front of them.',
    howTo: [
      'Fill it before you need it, not when you notice you are thirsty.',
      'Refill it at a fixed point in the day.',
      'Thirst is a late signal, especially as you get older.',
    ],
    benefit:
      'Consistent fluid intake is associated with lower kidney stone recurrence and fewer urinary tract infections.',
    target: 'The bottle emptied and refilled at least once.',
    tags: ['hydration'],
    sourceName: MEDLINEPLUS,
    sourceUrl: 'https://medlineplus.gov/kidneystones.html',
  },
];
