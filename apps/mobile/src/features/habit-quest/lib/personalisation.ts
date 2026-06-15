import type { Goal, Quest, FocusArea } from "../types";
import type { ActionType } from "../types";

const goalFocusMap: Record<Goal, Array<FocusArea>> = {
  "weight-loss": ["drink-more-water", "move-a-little-more", "eat-more-balanced-meals"],
  "general-fitness": ["move-a-little-more", "build-routine"],
  "better-eating": ["eat-more-balanced-meals", "drink-more-water"],
  "mental-wellbeing": ["check-in-with-mood", "improve-sleep", "build-routine"],
};

const goalPriorityActions: Record<Goal, Array<ActionType>> = {
  "weight-loss": ["water", "walk", "meal"],
  "general-fitness": ["walk", "workout", "water"],
  "better-eating": ["meal", "water"],
  "mental-wellbeing": ["mood", "sleep", "rest"],
};

const goalZonePriority: Record<Goal, Array<string>> = {
  "weight-loss": ["energy-plains", "nourish-marsh"],
  "general-fitness": ["energy-plains", "strength-peak"],
  "better-eating": ["nourish-marsh", "mindful-marsh"],
  "mental-wellbeing": ["calm-grove", "dream-hill"],
};

export function getFocusForGoals(goals: Array<Goal>): Array<FocusArea> {
  const focusSet = new Set<FocusArea>();

  for (const goal of goals) {
    const areas = goalFocusMap[goal];
    if (areas) {
      for (const area of areas) {
        focusSet.add(area);
      }
    }
  }

  return Array.from(focusSet);
}

export function getPriorityActionsForGoals(goals: Array<Goal>): Array<ActionType> {
  const actionSet = new Set<ActionType>();

  for (const goal of goals) {
    const actions = goalPriorityActions[goal];
    if (actions) {
      for (const action of actions) {
        actionSet.add(action);
      }
    }
  }

  return Array.from(actionSet);
}

export function getZonePriorityForGoals(goals: Array<Goal>): Array<string> {
  const zoneSet = new Set<string>();

  for (const goal of goals) {
    const zones = goalZonePriority[goal];
    if (zones) {
      for (const zone of zones) {
        zoneSet.add(zone);
      }
    }
  }

  return Array.from(zoneSet);
}

export function applyPersonalisation(quests: Array<Quest>, goals: Array<Goal>): Array<Quest> {
  if (goals.length === 0) return quests;

  const priorityFocus = getFocusForGoals(goals);

  const scored = quests.map((quest) => {
    let score = 0;

    if (quest.focusAreas && quest.focusAreas.length > 0) {
      const matchCount = quest.focusAreas.filter((fa) => priorityFocus.includes(fa)).length;
      score += matchCount * 10;
    }

    return { quest, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.quest);
}
