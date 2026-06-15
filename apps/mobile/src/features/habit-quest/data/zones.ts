import type { ZoneId, ZoneProgress } from "../types";

export interface ZoneDef {
  zoneId: ZoneId;
  name: string;
  description: string;
  maxProgress: number;
  order: number;
}

export const zoneDefs: Record<ZoneId, ZoneDef> = {
  "energy-plains": {
    zoneId: "energy-plains",
    name: "Energy Plains",
    description: "Movement and vitality grow here.",
    maxProgress: 100,
    order: 1,
  },
  "nourish-marsh": {
    zoneId: "nourish-marsh",
    name: "Nourish Marsh",
    description: "A gentle place for balanced eating habits.",
    maxProgress: 100,
    order: 2,
  },
  "strength-peak": {
    zoneId: "strength-peak",
    name: "Strength Peak",
    description: "Where routine and consistency build power.",
    maxProgress: 100,
    order: 3,
  },
  "mindful-marsh": {
    zoneId: "mindful-marsh",
    name: "Mindful Marsh",
    description: "A reflective space for eating with awareness.",
    maxProgress: 100,
    order: 4,
  },
  "calm-grove": {
    zoneId: "calm-grove",
    name: "Calm Grove",
    description: "Peace and emotional balance bloom here.",
    maxProgress: 100,
    order: 5,
  },
  "dream-hill": {
    zoneId: "dream-hill",
    name: "Dream Hill",
    description: "Rest and recovery shape this gentle slope.",
    maxProgress: 100,
    order: 6,
  },
};

export function makeInitialZones(): Record<ZoneId, ZoneProgress> {
  const zoneList: Array<ZoneId> = [
    "energy-plains",
    "nourish-marsh",
    "strength-peak",
    "mindful-marsh",
    "calm-grove",
    "dream-hill",
  ];

  const zones: Partial<Record<ZoneId, ZoneProgress>> = {};

  for (const id of zoneList) {
    zones[id] = {
      zoneId: id,
      progress: zoneDefs[id].zoneId === "energy-plains" ? 0 : 0,
      maxProgress: zoneDefs[id].maxProgress,
      unlocked: id === "energy-plains",
    };
  }

  return zones as Record<ZoneId, ZoneProgress>;
}
