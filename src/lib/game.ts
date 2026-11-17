export const CRIME_COOLDOWN_SECONDS = 90;
export const ENERGY_REGEN_MS = 180_000; // 3 minutes per energy

export type CrimeDef = {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  minRankLevel: number;
  baseSuccess: number;
  minCash: number;
  maxCash: number;
  xpSuccess: number;
  xpFail: number;
  heat: number;
};

export const CRIMES: CrimeDef[] = [
  {
    id: "pickpocket",
    name: "Pickpocket",
    description: "Lift a wallet from a distracted mark in the crowd.",
    energyCost: 1,
    minRankLevel: 1,
    baseSuccess: 0.82,
    minCash: 25,
    maxCash: 70,
    xpSuccess: 3,
    xpFail: 1,
    heat: 1
  },
  {
    id: "street_robbery",
    name: "Street Robbery",
    description: "A quick stick-up on a quiet side street. Fast money, some risk.",
    energyCost: 1,
    minRankLevel: 1,
    baseSuccess: 0.72,
    minCash: 80,
    maxCash: 200,
    xpSuccess: 6,
    xpFail: 2,
    heat: 2
  },
  {
    id: "shop_job",
    name: "Shop Job",
    description: "Hit a small corner store after hours. Better pay, tighter window.",
    energyCost: 2,
    minRankLevel: 2,
    baseSuccess: 0.65,
    minCash: 180,
    maxCash: 420,
    xpSuccess: 12,
    xpFail: 3,
    heat: 3
  },
  {
    id: "warehouse",
    name: "Warehouse Score",
    description: "Break into a goods warehouse on the docks. Serious cash if you get clean.",
    energyCost: 3,
    minRankLevel: 4,
    baseSuccess: 0.55,
    minCash: 400,
    maxCash: 950,
    xpSuccess: 22,
    xpFail: 5,
    heat: 5
  },
  {
    id: "armoured",
    name: "Armoured Van",
    description: "Intercept a cash run. High reward, high chance of heat.",
    energyCost: 4,
    minRankLevel: 7,
    baseSuccess: 0.42,
    minCash: 900,
    maxCash: 2200,
    xpSuccess: 40,
    xpFail: 8,
    heat: 8
  }
];

export function energyAfterRegen(
  current: number,
  maximum: number,
  lastAt: Date,
  now = new Date()
) {
  const intervals = Math.floor(
    (now.getTime() - lastAt.getTime()) / ENERGY_REGEN_MS
  );

  const gained = Math.min(
    maximum - current,
    Math.max(0, intervals)
  );

  return {
    energy: current + gained,
    lastEnergyAt:
      gained > 0
        ? new Date(lastAt.getTime() + gained * ENERGY_REGEN_MS)
        : lastAt
  };
}

export function rollCrime(crime: CrimeDef, rankLevel: number) {
  const successChance = Math.min(
    0.92,
    crime.baseSuccess + Math.max(0, rankLevel - crime.minRankLevel) * 0.015
  );

  const success = Math.random() < successChance;
  const cash = success
    ? crime.minCash +
      Math.floor(Math.random() * (crime.maxCash - crime.minCash + 1))
    : 0;

  return {
    success,
    cash,
    xp: success ? crime.xpSuccess : crime.xpFail,
    heat: success ? crime.heat : Math.ceil(crime.heat / 2)
  };
}

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(40 * level * (level - 1) * 0.7);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < 20 && xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}
