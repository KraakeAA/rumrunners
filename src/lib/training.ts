// The Gymnasium. Three stats, each trained with energy only. Every stat tops out at level 30.
//
//  Strength: the heavier guns can't be held until your Strength is high enough.
//  Stamina:  less energy spent on crimes and auto theft.
//  Agility:  better odds when breaking someone out of jail (or yourself).

export type StatKey = "strength" | "stamina" | "agility";

export const STATS: { key: StatKey; label: string; blurb: string }[] = [
  { key: "strength", label: "Strength", blurb: "Needed to buy the heavier guns at the Store." },
  { key: "stamina", label: "Stamina", blurb: "Crimes and auto theft cost you less energy." },
  { key: "agility", label: "Agility", blurb: "Better odds of busting someone out of jail." }
];

export const MAX_LEVEL = 30;
// Total xp needed to reach a level is 40 x level squared, so level 30 takes 36,000 xp.
export const XP_FACTOR = 40;
export const xpForLevel = (level: number) => XP_FACTOR * level * level;

export const levelOf = (points: number) =>
  Math.min(MAX_LEVEL, Math.floor(Math.sqrt(Math.max(0, points) / XP_FACTOR)));

// How far through the current level you are. At the top level the bar is full.
export function progress(points: number) {
  const level = levelOf(points);
  if (level >= MAX_LEVEL) return { level, into: 1, needed: 1, maxed: true };
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, into: Math.max(0, points) - from, needed: to - from, maxed: false };
}

// Each stat has the same four sessions: the longer ones give more xp for the energy.
export type Session = { key: string; energy: number; xp: number };
export const SESSIONS: Session[] = [
  { key: "light", energy: 25, xp: 10 },
  { key: "standard", energy: 50, xp: 22 },
  { key: "hard", energy: 100, xp: 48 },
  { key: "intense", energy: 200, xp: 105 }
];

export const SESSION_NAMES: Record<StatKey, Record<string, string>> = {
  strength: { light: "Press-ups", standard: "Weight lifting", hard: "Heavy lifting", intense: "Wrestling bout" },
  stamina: { light: "Skipping", standard: "Road running", hard: "Long-distance run", intense: "Boxing rounds" },
  agility: { light: "Rope work", standard: "Climbing ropes", hard: "Obstacle course", intense: "Sparring" }
};

// Stamina: 1% off energy per level, so 30% off at level 30.
export const STAMINA_PER_LEVEL = 0.01;
export const STAMINA_MAX_DISCOUNT = 0.3;

export function staminaDiscount(staminaLevel: number): number {
  return Math.min(STAMINA_MAX_DISCOUNT, Math.max(0, staminaLevel) * STAMINA_PER_LEVEL);
}

export function energyCostFor(base: number, staminaLevel: number): number {
  return Math.max(1, Math.round(base * (1 - staminaDiscount(staminaLevel))));
}

// Agility: up to +25% to the chance of a jail break, reached at level 30.
export function agilityBonus(agilityLevel: number): number {
  return Math.min(0.25, (Math.max(0, agilityLevel) * 0.25) / MAX_LEVEL);
}

export const pointsKey = (k: StatKey) => `${k}Pts` as "strengthPts" | "staminaPts" | "agilityPts";

export type TrainingLevels = { strength: number; stamina: number; agility: number };

export function levelsOf(p: { strengthPts: number; staminaPts: number; agilityPts: number }): TrainingLevels {
  return {
    strength: levelOf(p.strengthPts),
    stamina: levelOf(p.staminaPts),
    agility: levelOf(p.agilityPts)
  };
}
