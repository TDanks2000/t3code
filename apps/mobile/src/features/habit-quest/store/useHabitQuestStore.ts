import { useCallback, useMemo, useSyncExternalStore } from "react";
import type {
  HabitQuestState,
  OnboardingAnswers,
  LoggedAction,
  LoggedMeal,
  WellbeingCheckIn,
  BossInstance,
} from "../types";
import { actionBalances } from "../data/actions";
import { getBossDef, weekBossSchedule } from "../data/bosses";
import { generateFirstWeekPlan } from "../data/firstWeek";
import { generateWeeklyQuests } from "../data/quests";
import { makeInitialZones } from "../data/zones";
import { applyPersonalisation } from "../lib/personalisation";

const STORAGE_KEY = "habit-quest-state";

let state: HabitQuestState = createInitialState();
const listeners: Set<() => void> = new Set();

function createInitialState(): HabitQuestState {
  const initialState: HabitQuestState = {
    onboardingComplete: false,
    firstWeekComplete: false,
    currentWeek: 1,
    currentBoss: null,
    companion: {
      name: "Buddy",
      stage: "egg",
      xp: 0,
      xpToNext: 50,
      level: 1,
    },
    zones: makeInitialZones(),
    activeQuests: [],
    completedQuests: [],
    loggedActions: [],
    loggedMeals: [],
    wellbeingCheckIns: [],
    rewards: [],
    bossHistory: [],
    weekStartTimestamp: Date.now(),
  };

  return initialState;
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getSnapshot(): HabitQuestState {
  return state;
}

function getServerSnapshot(): HabitQuestState {
  return createInitialState();
}

function persistState(): void {
  try {
    const json = JSON.stringify(state);
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      try {
        (globalThis as any).localStorage.setItem(STORAGE_KEY, json);
      } catch {
        // Web storage may not be available in RN
      }
    }
  } catch {
    // Silently fail — persistence is best-effort
  }
}

function loadPersistedState(): HabitQuestState | null {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      try {
        const raw = (globalThis as any).localStorage.getItem(STORAGE_KEY);
        if (raw) {
          return JSON.parse(raw) as HabitQuestState;
        }
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function generateBossForWeek(week: number): BossInstance {
  const scheduleIndex = (week - 1) % weekBossSchedule.length;
  const bossDefId = weekBossSchedule[scheduleIndex];
  const bossDef = getBossDef(bossDefId);

  return {
    defId: bossDefId,
    currentHp: bossDef.baseHp,
    maxHp: bossDef.baseHp,
    week,
    weakened: false,
  };
}

let actionIdCounter = 0;
let mealIdCounter = 0;
let wellbeingIdCounter = 0;
let rewardIdCounter = 0;

export const store = {
  getState(): HabitQuestState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  initialize(): void {
    const persisted = loadPersistedState();
    if (persisted) {
      state = persisted;
      notify();
    }
  },

  completeOnboarding(answers: OnboardingAnswers): void {
    state = {
      ...state,
      onboardingComplete: true,
      onboardingAnswers: answers,
    };

    const plan = generateFirstWeekPlan({
      goals: answers.goals,
      focusAreas: answers.focusAreas,
    });

    const boss = generateBossForWeek(1);

    const baseQuests = generateWeeklyQuests(answers.goals, answers.focusAreas, 1);
    const personalisedQuests = applyPersonalisation(baseQuests, answers.goals);

    state = {
      ...state,
      firstWeekPlan: plan,
      currentBoss: boss,
      activeQuests: personalisedQuests,
      weekStartTimestamp: Date.now(),
    };

    persistState();
    notify();
  },

  logAction(actionType: import("../types").ActionType, note?: string): void {
    actionIdCounter += 1;

    const action: LoggedAction = {
      id: `action-${actionIdCounter}`,
      actionType,
      timestamp: Date.now(),
      note,
    };

    const balance = actionBalances[actionType];
    const bossDef = state.currentBoss ? getBossDef(state.currentBoss.defId) : null;
    const isWeakness = bossDef?.weaknessActionTypes.includes(actionType);
    const damageMultiplier = isWeakness ? 1.5 : 1;
    const damage = Math.round(balance.damage * damageMultiplier);

    let boss = state.currentBoss ? { ...state.currentBoss } : null;
    if (boss) {
      boss.currentHp = Math.max(0, boss.currentHp - damage);
      if (boss.currentHp <= 0) {
        boss.weakened = true;
      }
    }

    const companion = { ...state.companion };
    companion.xp = Math.min(companion.xp + balance.companionXp, companion.xpToNext);

    const zones = { ...state.zones };
    const weaknessZones = bossDef ? [bossDef.zone] : [];

    for (const zoneId of weaknessZones) {
      if (zones[zoneId]) {
        zones[zoneId] = {
          ...zones[zoneId],
          progress: Math.min(
            zones[zoneId].progress + Math.round(balance.zoneProgress * 1.3),
            zones[zoneId].maxProgress,
          ),
        };
      }
    }

    const energyZone = zones["energy-plains"];
    if (energyZone) {
      zones["energy-plains"] = {
        ...energyZone,
        progress: Math.min(energyZone.progress + balance.zoneProgress, energyZone.maxProgress),
      };
    }

    const quests = state.activeQuests.map((q) => {
      if (q.completed) return q;

      let progress = q.progress;

      if (q.requirement.type === "action-count") {
        progress += 1;
      } else if (q.requirement.type === "action-type" && q.requirement.actionType === actionType) {
        progress += 1;
      }

      const completed = progress >= q.requirement.count;

      return { ...q, progress, completed };
    });

    const completedNow = quests.filter(
      (q) => q.completed && !state.activeQuests.find((oq) => oq.id === q.id)?.completed,
    );

    const completedQuests = [...state.completedQuests];
    const newRewards: Array<import("../types").Reward> = [...state.rewards];

    for (const q of completedNow) {
      rewardIdCounter += 1;
      completedQuests.push({ ...q, completedAt: Date.now() });
      companion.xp = Math.min(companion.xp + q.reward.companionXp, companion.xpToNext);
      newRewards.push({
        id: `reward-${rewardIdCounter}`,
        label: `Quest: ${q.title}`,
        description: `Completed ${q.title}`,
        earnedAt: Date.now(),
        type: "badge",
      });
    }

    const activeQuests = quests.filter((q) => !q.completed);

    state = {
      ...state,
      loggedActions: [...state.loggedActions, action],
      currentBoss: boss,
      companion,
      zones,
      activeQuests,
      completedQuests,
      rewards: newRewards,
    };

    persistState();
    notify();
  },

  logMeal(meal: Omit<LoggedMeal, "id" | "timestamp">): void {
    mealIdCounter += 1;

    const loggedMeal: LoggedMeal = {
      ...meal,
      id: `meal-${mealIdCounter}`,
      timestamp: Date.now(),
    };

    const companion = { ...state.companion };
    const balance = actionBalances["meal"];
    companion.xp = Math.min(companion.xp + balance.companionXp, companion.xpToNext);

    let boss = state.currentBoss ? { ...state.currentBoss } : null;
    if (boss) {
      const bossDef = getBossDef(boss.defId);
      const isWeakness = bossDef.weaknessActionTypes.includes("meal");
      const damageMultiplier = isWeakness ? 1.5 : 1;
      const damage = Math.round(balance.damage * damageMultiplier);
      boss.currentHp = Math.max(0, boss.currentHp - damage);
      if (boss.currentHp <= 0) {
        boss.weakened = true;
      }
    }

    const zones = { ...state.zones };
    const nourishZone = zones["nourish-marsh"];
    if (nourishZone) {
      zones["nourish-marsh"] = {
        ...nourishZone,
        progress: Math.min(nourishZone.progress + balance.zoneProgress, nourishZone.maxProgress),
      };
    }

    state = {
      ...state,
      loggedMeals: [...state.loggedMeals, loggedMeal],
      companion,
      currentBoss: boss,
      zones,
    };

    persistState();
    notify();
  },

  checkInWellbeing(checkIn: Omit<WellbeingCheckIn, "id" | "timestamp">): void {
    wellbeingIdCounter += 1;

    const wellbeing: WellbeingCheckIn = {
      ...checkIn,
      id: `wellbeing-${wellbeingIdCounter}`,
      timestamp: Date.now(),
    };

    const companion = { ...state.companion };
    const balance = actionBalances["mood"];
    companion.xp = Math.min(companion.xp + balance.companionXp, companion.xpToNext);

    let boss = state.currentBoss ? { ...state.currentBoss } : null;
    if (boss) {
      const bossDef = getBossDef(boss.defId);
      const isWeakness = bossDef.weaknessActionTypes.includes("mood");
      const damageMultiplier = isWeakness ? 1.5 : 1;
      const damage = Math.round(balance.damage * damageMultiplier);
      boss.currentHp = Math.max(0, boss.currentHp - damage);
      if (boss.currentHp <= 0) {
        boss.weakened = true;
      }
    }

    const zones = { ...state.zones };
    const calmZone = zones["calm-grove"];
    if (calmZone) {
      zones["calm-grove"] = {
        ...calmZone,
        progress: Math.min(calmZone.progress + balance.zoneProgress * 2, calmZone.maxProgress),
      };
    }

    state = {
      ...state,
      wellbeingCheckIns: [...state.wellbeingCheckIns, wellbeing],
      companion,
      currentBoss: boss,
      zones,
    };

    persistState();
    notify();
  },

  newWeek(): void {
    const newWeek = state.currentWeek + 1;
    const boss = generateBossForWeek(newWeek);

    if (state.currentBoss) {
      const totalDamage = state.currentBoss.maxHp - state.currentBoss.currentHp;
      state.bossHistory.push({
        bossDefId: state.currentBoss.defId,
        week: state.currentWeek,
        defeated: state.currentBoss.weakened,
        totalDamage,
      });
    }

    const quests = generateWeeklyQuests(
      state.onboardingAnswers?.goals ?? [],
      state.onboardingAnswers?.focusAreas ?? [],
      newWeek,
    );

    const personalisedQuests = applyPersonalisation(quests, state.onboardingAnswers?.goals ?? []);

    state = {
      ...state,
      currentWeek: newWeek,
      currentBoss: boss,
      activeQuests: personalisedQuests,
      weekStartTimestamp: Date.now(),
      firstWeekComplete: true,
    };

    persistState();
    notify();
  },

  toggleWeekIfNeeded(): void {
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - state.weekStartTimestamp;

    if (elapsed >= oneWeekMs) {
      store.newWeek();
    }
  },

  resetGame(): void {
    state = createInitialState();
    persistState();
    notify();
  },
};

export function useHabitQuestState(): HabitQuestState {
  const snapshot = useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);

  return snapshot;
}

export function useStoreAction<K extends keyof typeof store>(actionName: K): (typeof store)[K] {
  return store[actionName];
}
