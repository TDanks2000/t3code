import type { FirstWeekPlan, FocusArea, Goal } from "../types";

interface FirstWeekConfig {
  goals: Array<Goal>;
  focusAreas: Array<FocusArea>;
}

export function generateFirstWeekPlan(config: FirstWeekConfig): FirstWeekPlan {
  const defaultFocus: Array<FocusArea> = ["drink-more-water", "move-a-little-more"];

  const focusAreas = config.focusAreas.length > 0 ? config.focusAreas.slice(0, 3) : defaultFocus;

  const goalLabels: Record<Goal, string> = {
    "weight-loss": "building sustainable habits",
    "general-fitness": "getting your body moving",
    "better-eating": "building a kinder relationship with food",
    "mental-wellbeing": "supporting your mind and emotions",
  };

  const goalDescriptions = config.goals.map((g) => goalLabels[g]).join(", ");

  return {
    weekTitle: "Build gentle momentum",
    focus: focusAreas,
    bossName: "Cloud Slime King",
    description: `This week is about learning the rhythm. Focus on ${goalDescriptions}. Tiny actions count. No pressure. Just progress.`,
  };
}
