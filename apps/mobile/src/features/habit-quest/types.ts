export type Goal = "weight-loss" | "general-fitness" | "better-eating" | "mental-wellbeing";

export type TrackingStyle = "habit-first" | "balanced" | "detailed";

export type WeightVisibility = "private" | "visible-in-progress" | "hidden-completely";

export type MealTrackingStyle = "quick-meal-tags" | "optional-nutrition" | "both";

export type FocusArea =
  | "drink-more-water"
  | "move-a-little-more"
  | "eat-more-balanced-meals"
  | "improve-sleep"
  | "check-in-with-mood"
  | "build-routine";

export type ActionType = "water" | "walk" | "meal" | "workout" | "sleep" | "mood" | "rest";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealTag =
  | "balanced"
  | "protein-focused"
  | "homemade"
  | "takeaway"
  | "treat"
  | "quick-bite"
  | "comfort-meal";

export type MoodLevel = "great" | "okay" | "low" | "stressed" | "tired";

export type WellbeingTag =
  | "rest"
  | "water"
  | "walk"
  | "talking-to-someone"
  | "food"
  | "sleep"
  | "fresh-air"
  | "small-win";

export type ZoneId =
  | "nourish-marsh"
  | "mindful-marsh"
  | "energy-plains"
  | "strength-peak"
  | "calm-grove"
  | "dream-hill";

export type CompanionStage = "egg" | "buddy" | "ally" | "guardian";

export interface BossDef {
  id: string;
  name: string;
  description: string;
  zone: ZoneId;
  baseHp: number;
  weaknessActionTypes: Array<ActionType>;
  introCopy: string;
  defeatedCopy: string;
  escapedCopy: string;
}

export interface BossInstance {
  defId: string;
  currentHp: number;
  maxHp: number;
  week: number;
  weakened: boolean;
}

export interface Companion {
  name: string;
  stage: CompanionStage;
  xp: number;
  xpToNext: number;
  level: number;
  equippedItem?: string;
}

export interface ZoneProgress {
  zoneId: ZoneId;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
}

export interface ActionBalance {
  actionType: ActionType;
  label: string;
  icon: string;
  damage: number;
  companionXp: number;
  zoneProgress: number;
  description: string;
}

export interface LoggedAction {
  id: string;
  actionType: ActionType;
  timestamp: number;
  note?: string;
}

export interface LoggedMeal {
  id: string;
  mealType: MealType;
  tags: Array<MealTag>;
  timestamp: number;
  calories?: number;
  protein?: number;
  notes?: string;
}

export interface WellbeingCheckIn {
  id: string;
  mood: MoodLevel;
  timestamp: number;
  note?: string;
  helpfulTags?: Array<WellbeingTag>;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  requirement: {
    type: "action-count" | "action-type" | "meal-log" | "mood-check" | "streak";
    actionType?: ActionType;
    count: number;
  };
  progress: number;
  completed: boolean;
  reward: {
    companionXp: number;
    zoneProgress: number;
    zoneId?: ZoneId;
  };
  focusAreas?: Array<FocusArea>;
}

export interface CompletedQuest extends Quest {
  completedAt: number;
}

export interface Reward {
  id: string;
  label: string;
  description: string;
  earnedAt: number;
  type: "badge" | "title" | "item" | "companion-skin";
}

export interface BossHistoryEntry {
  bossDefId: string;
  week: number;
  defeated: boolean;
  totalDamage: number;
}

export interface FirstWeekPlan {
  weekTitle: string;
  focus: Array<FocusArea>;
  bossName: string;
  description: string;
}

export interface OnboardingAnswers {
  goals: Array<Goal>;
  trackingStyle: TrackingStyle;
  weightVisibility: WeightVisibility;
  mealTrackingStyle: MealTrackingStyle;
  focusAreas: Array<FocusArea>;
}

export interface HabitQuestState {
  onboardingComplete: boolean;
  onboardingAnswers?: OnboardingAnswers;

  firstWeekComplete: boolean;
  firstWeekPlan?: FirstWeekPlan;

  currentWeek: number;
  currentBoss: BossInstance | null;
  companion: Companion;
  zones: Record<ZoneId, ZoneProgress>;
  activeQuests: Array<Quest>;
  completedQuests: Array<CompletedQuest>;
  loggedActions: Array<LoggedAction>;
  loggedMeals: Array<LoggedMeal>;
  wellbeingCheckIns: Array<WellbeingCheckIn>;
  rewards: Array<Reward>;
  bossHistory: Array<BossHistoryEntry>;

  weekStartTimestamp: number;
}
