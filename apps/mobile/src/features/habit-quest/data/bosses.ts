import type { BossDef } from "../types";

export const bossRegistry: Record<string, BossDef> = {
  "cloud-slime-king": {
    id: "cloud-slime-king",
    name: "Cloud Slime King",
    description:
      "A wobbly, fluffy blob of low energy. He represents the gentle fog of low momentum that settles in when healthy habits drift away.",
    zone: "energy-plains",
    baseHp: 100,
    weaknessActionTypes: ["water", "walk", "mood"],
    introCopy:
      "The Cloud Slime King looms softly — not threatening, just… there. A little water, a short walk, or even checking in with yourself can make him shrink.",
    defeatedCopy:
      "The Cloud Slime King dissolves into a gentle mist. You step through it, feeling lighter.",
    escapedCopy:
      "The Cloud Slime King wanders off for now. Some days, even showing up is enough to weaken him.",
  },
  "routine-golem": {
    id: "routine-golem",
    name: "Routine Golem",
    description:
      "A slow, sturdy creature made of half-started plans and forgotten alarms. It only moves when you do.",
    zone: "strength-peak",
    baseHp: 120,
    weaknessActionTypes: ["walk", "workout", "sleep"],
    introCopy:
      "The Routine Golem stands there, arms crossed. It's been waiting for you to make the first move. Any small step counts.",
    defeatedCopy:
      "The Routine Golem crumbles into pebbles of old inertia. You built new ground to stand on.",
    escapedCopy: "The Routine Golem shrinks back. It'll return, but you've proven you can move it.",
  },
  "mist-guardian": {
    id: "mist-guardian",
    name: "Mist Guardian",
    description:
      "A swirling haze of scattered thoughts and stress. It blurs what matters most and makes starting feel harder than it is.",
    zone: "calm-grove",
    baseHp: 90,
    weaknessActionTypes: ["mood", "sleep", "rest"],
    introCopy:
      "The Mist Guardian swirls quietly, filling the air with static. A deep breath, a rest, or checking your feelings can cut through the haze.",
    defeatedCopy: "The Mist Guardian parts like morning fog. The path ahead is clear again.",
    escapedCopy: "The Mist Guardian thins, retreating into the trees. You found a moment of calm.",
  },
  "sleepy-shade": {
    id: "sleepy-shade",
    name: "Sleepy Shade",
    description:
      "A drowsy shadow that feeds on tired routines and skipped rest. The more you rest, the smaller it gets.",
    zone: "dream-hill",
    baseHp: 80,
    weaknessActionTypes: ["sleep", "rest", "water"],
    introCopy:
      "The Sleepy Shade yawns, and you feel the urge to do the same. Rest is your weapon here — it feeds on exhaustion, not on you.",
    defeatedCopy: "The Sleepy Shade curls up and drifts off. Rest wins again.",
    escapedCopy:
      "The Sleepy Shade fades into a nap. It'll be back, but you're learning that rest is strength.",
  },
  "snack-sprite": {
    id: "snack-sprite",
    name: "Snack Sprite",
    description:
      "A mischievous little sprite born from chaotic eating patterns. It thrives on skipped meals and rushed bites.",
    zone: "nourish-marsh",
    baseHp: 100,
    weaknessActionTypes: ["meal", "water"],
    introCopy:
      "The Snack Sprite darts around, playful but distracting. Logging a meal — any meal — makes it stop and pay attention.",
    defeatedCopy: "The Snack Sprite sits down and shares a quiet snack with you. Balance restored.",
    escapedCopy:
      "The Snack Sprite zips away, full of energy but a little less chaotic. You made progress.",
  },
};

export const weekBossSchedule: Array<string> = [
  "cloud-slime-king",
  "routine-golem",
  "mist-guardian",
  "sleepy-shade",
  "snack-sprite",
  "cloud-slime-king",
  "routine-golem",
];

export function getBossDef(defId: string): BossDef {
  const boss = bossRegistry[defId];
  if (!boss) {
    return bossRegistry["cloud-slime-king"];
  }
  return boss;
}
