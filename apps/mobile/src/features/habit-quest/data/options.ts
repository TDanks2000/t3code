import type { Goal, TrackingStyle, WeightVisibility, MealTrackingStyle, FocusArea } from "../types";

export const goalOptions: Array<{
  value: Goal;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: "weight-loss",
    label: "Weight Loss",
    description: "Build sustainable habits for a healthier body.",
    icon: "🌱",
  },
  {
    value: "general-fitness",
    label: "General Fitness",
    description: "Move more, feel stronger, build energy.",
    icon: "💪",
  },
  {
    value: "better-eating",
    label: "Better Eating",
    description: "Build a kinder relationship with food.",
    icon: "🥗",
  },
  {
    value: "mental-wellbeing",
    label: "Mental Wellbeing",
    description: "Support your mind and emotions.",
    icon: "🌸",
  },
];

export const trackingStyleOptions: Array<{
  value: TrackingStyle;
  label: string;
  description: string;
}> = [
  {
    value: "habit-first",
    label: "Habit-first",
    description: "Log actions, not numbers. Gentle and simple.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Some numbers, some feelings. Your choice.",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Optional calories, protein, and deeper tracking.",
  },
];

export const weightVisibilityOptions: Array<{
  value: WeightVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "private",
    label: "Private",
    description: "Only you can see your weight data.",
  },
  {
    value: "visible-in-progress",
    label: "Visible in progress only",
    description: "Shown on the progress screen, not on battle or track.",
  },
  {
    value: "hidden-completely",
    label: "Hidden completely",
    description: "Weight tracking is turned off.",
  },
];

export const mealTrackingStyleOptions: Array<{
  value: MealTrackingStyle;
  label: string;
  description: string;
}> = [
  {
    value: "quick-meal-tags",
    label: "Quick meal tags",
    description: "Just tags. No numbers needed.",
  },
  {
    value: "optional-nutrition",
    label: "Optional nutrition details",
    description: "Calories and protein if you want them.",
  },
  {
    value: "both",
    label: "Both",
    description: "Tags with optional nutrition.",
  },
];

export const focusAreaOptions: Array<{
  value: FocusArea;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: "drink-more-water",
    label: "Drink more water",
    description: "Stay hydrated throughout the day.",
    icon: "💧",
  },
  {
    value: "move-a-little-more",
    label: "Move a little more",
    description: "Gentle movement, short walks, stretching.",
    icon: "🚶",
  },
  {
    value: "eat-more-balanced-meals",
    label: "Eat more balanced meals",
    description: "Nourish your body with variety.",
    icon: "🥗",
  },
  {
    value: "improve-sleep",
    label: "Improve sleep",
    description: "Better rest, better recovery.",
    icon: "😴",
  },
  {
    value: "check-in-with-mood",
    label: "Check in with mood",
    description: "Notice how you feel, without judgement.",
    icon: "🌸",
  },
  {
    value: "build-routine",
    label: "Build routine",
    description: "Create gentle daily anchors.",
    icon: "📋",
  },
];
