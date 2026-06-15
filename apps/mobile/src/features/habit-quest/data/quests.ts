import type { Quest, Goal, FocusArea } from "../types";

interface QuestTemplate {
  title: string;
  description: string;
  requirementType: "action-count" | "action-type" | "meal-log" | "mood-check" | "streak";
  requirementCount: number;
  actionType?: import("../types").ActionType;
  rewardXp: number;
  rewardZone: number;
  focusAreas?: Array<FocusArea>;
}

const questTemplates: Array<QuestTemplate> = [
  {
    title: "Water Explorer",
    description: "Log 3 glasses of water.",
    requirementType: "action-type",
    requirementCount: 3,
    actionType: "water",
    rewardXp: 15,
    rewardZone: 5,
    focusAreas: ["drink-more-water"],
  },
  {
    title: "Gentle Mover",
    description: "Take 2 walks or do light movement.",
    requirementType: "action-type",
    requirementCount: 2,
    actionType: "walk",
    rewardXp: 20,
    rewardZone: 8,
    focusAreas: ["move-a-little-more"],
  },
  {
    title: "Balanced Plate",
    description: "Log 2 meals.",
    requirementType: "meal-log",
    requirementCount: 2,
    rewardXp: 15,
    rewardZone: 5,
    focusAreas: ["eat-more-balanced-meals"],
  },
  {
    title: "Restful Night",
    description: "Log 2 sleep or rest actions.",
    requirementType: "action-type",
    requirementCount: 2,
    actionType: "sleep",
    rewardXp: 10,
    rewardZone: 4,
    focusAreas: ["improve-sleep"],
  },
  {
    title: "Feelings Friend",
    description: "Check in with your mood once.",
    requirementType: "mood-check",
    requirementCount: 1,
    rewardXp: 10,
    rewardZone: 5,
    focusAreas: ["check-in-with-mood"],
  },
  {
    title: "Rythmn Builder",
    description: "Log 5 actions of any kind.",
    requirementType: "action-count",
    requirementCount: 5,
    rewardXp: 20,
    rewardZone: 5,
    focusAreas: ["build-routine"],
  },
  {
    title: "Hydration Hero",
    description: "Log 5 glasses of water.",
    requirementType: "action-type",
    requirementCount: 5,
    actionType: "water",
    rewardXp: 25,
    rewardZone: 10,
    focusAreas: ["drink-more-water"],
  },
  {
    title: "Daily Mover",
    description: "Take 4 walks or movement breaks.",
    requirementType: "action-type",
    requirementCount: 4,
    actionType: "walk",
    rewardXp: 30,
    rewardZone: 12,
    focusAreas: ["move-a-little-more"],
  },
  {
    title: "Mindful Eater",
    description: "Log 4 meals with tags.",
    requirementType: "meal-log",
    requirementCount: 4,
    rewardXp: 25,
    rewardZone: 8,
    focusAreas: ["eat-more-balanced-meals"],
  },
  {
    title: "Wellness Week",
    description: "Log 10 actions total.",
    requirementType: "action-count",
    requirementCount: 10,
    rewardXp: 40,
    rewardZone: 10,
  },
  {
    title: "Strength Builder",
    description: "Do 2 workout sessions.",
    requirementType: "action-type",
    requirementCount: 2,
    actionType: "workout",
    rewardXp: 30,
    rewardZone: 15,
    focusAreas: ["move-a-little-more"],
  },
  {
    title: "Mood Tracker",
    description: "Check in with your mood 3 times.",
    requirementType: "mood-check",
    requirementCount: 3,
    rewardXp: 20,
    rewardZone: 10,
    focusAreas: ["check-in-with-mood"],
  },
  {
    title: "Rest Master",
    description: "Log 3 rest actions.",
    requirementType: "action-type",
    requirementCount: 3,
    actionType: "rest",
    rewardXp: 15,
    rewardZone: 8,
    focusAreas: ["improve-sleep"],
  },
  {
    title: "Sleep Support",
    description: "Log 3 sleep actions.",
    requirementType: "action-type",
    requirementCount: 3,
    actionType: "sleep",
    rewardXp: 20,
    rewardZone: 8,
    focusAreas: ["improve-sleep"],
  },
  {
    title: "Meal Variety",
    description: "Log 3 different meal types.",
    requirementType: "meal-log",
    requirementCount: 3,
    rewardXp: 25,
    rewardZone: 10,
    focusAreas: ["eat-more-balanced-meals"],
  },
];

let questIdCounter = 0;

export function generateWeeklyQuests(
  goals: Array<Goal>,
  focusAreas: Array<FocusArea>,
  week: number,
): Array<Quest> {
  const count = week === 1 ? 3 : 4 + Math.min(week - 1, 3);

  const matchedTemplates = questTemplates.filter((qt) => {
    if (week === 1) {
      return true;
    }
    if (!qt.focusAreas || qt.focusAreas.length === 0) {
      return true;
    }
    return qt.focusAreas.some((fa) => focusAreas.includes(fa));
  });

  const shuffled = [...matchedTemplates].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  return selected.map((t) => {
    questIdCounter += 1;

    const quest: Quest = {
      id: `quest-${week}-${questIdCounter}`,
      title: t.title,
      description: t.description,
      requirement: {
        type: t.requirementType,
        actionType: t.actionType,
        count: t.requirementCount,
      },
      progress: 0,
      completed: false,
      reward: {
        companionXp: t.rewardXp,
        zoneProgress: t.rewardZone,
      },
      focusAreas: t.focusAreas,
    };

    return quest;
  });
}
