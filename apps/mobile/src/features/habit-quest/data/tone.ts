import { copy } from "./copy";

export interface ToneMessage {
  id: string;
  message: string;
  context: Array<string>;
}

function buildRegistry(): Array<ToneMessage> {
  const messages: Array<ToneMessage> = [
    {
      id: "small-actions-count",
      message: copy.encouragement.smallActions,
      context: ["general", "action-logged", "empty-state"],
    },
    {
      id: "no-pressure",
      message: copy.encouragement.noPressure,
      context: ["general", "onboarding", "first-week"],
    },
    {
      id: "weakened-boss",
      message: copy.encouragement.weakenedBoss,
      context: ["boss-damaged", "action-logged"],
    },
    {
      id: "all-food-has-place",
      message: copy.encouragement.allFoodHasAPlace,
      context: ["meal-logged", "meal-screen"],
    },
    {
      id: "rest-counts",
      message: copy.encouragement.restCountsToo,
      context: ["rest-logged", "general"],
    },
    {
      id: "you-showed-up",
      message: copy.encouragement.youShowedUp,
      context: ["daily-first-action", "general"],
    },
    {
      id: "companion-proud",
      message: copy.encouragement.companionProud,
      context: ["companion-level-up", "companion-screen"],
    },
    {
      id: "tiny-actions",
      message: "Tiny actions add up over time.",
      context: ["general", "first-week"],
    },
    {
      id: "consistency",
      message: "Consistency matters more than perfection.",
      context: ["general", "streak", "progress"],
    },
    {
      id: "treat-is-okay",
      message: copy.meal.treatIsOkay,
      context: ["meal-logged-treat", "meal-screen"],
    },
    {
      id: "no-numbers-needed",
      message: "You don't need numbers here. Your actions speak.",
      context: ["meal-screen", "tracking-screen"],
    },
    {
      id: "youre-learning",
      message: "You're learning what works for you. That's the real progress.",
      context: ["first-week", "general"],
    },
    {
      id: "one-step",
      message: "One step at a time. You're doing fine.",
      context: ["general", "overwhelmed"],
    },
    {
      id: "momentum-builds",
      message: "Momentum builds quietly. Keep going.",
      context: ["progress", "streak"],
    },
    {
      id: "water-drop",
      message: "Every drop of water is a small win.",
      context: ["water-logged", "general"],
    },
    {
      id: "mood-matters",
      message: "Your feelings matter. Thanks for checking in.",
      context: ["mood-logged", "wellbeing-screen"],
    },
    {
      id: "walk-counts",
      message: "A short walk still moves you forward.",
      context: ["walk-logged", "general"],
    },
    {
      id: "sleep-strength",
      message: "Rest makes you stronger. Sleep is training too.",
      context: ["sleep-logged", "rest-logged"],
    },
    {
      id: "meal-kindness",
      message: "You fed yourself today. That matters.",
      context: ["meal-logged", "general"],
    },
    {
      id: "showing-up-is-enough",
      message: "Some days just showing up is the win.",
      context: ["general", "low-energy", "first-week"],
    },
  ];

  return messages;
}

export const toneRegistry = buildRegistry();

export function getToneMessage(context: string): string {
  const matching = toneRegistry.filter((m) => m.context.includes(context));
  if (matching.length === 0) {
    return copy.encouragement.smallActions;
  }
  return matching[Math.floor(Math.random() * matching.length)].message;
}
