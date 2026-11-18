// Shared settings and helpers for player-owned casinos and bullet factories.
// Pure data, no database access, so the server and the browser can both use it.

export type CityInfo = { name: string; region: string };

export const CITY_LIST: CityInfo[] = [
  { name: "London", region: "Greater London" },
  { name: "Birmingham", region: "West Midlands" },
  { name: "Manchester", region: "Greater Manchester" },
  { name: "Liverpool", region: "Merseyside" },
  { name: "Glasgow", region: "Scotland" }
];

export const CITIES = CITY_LIST.map((c) => c.name);

export type CasinoGameKey = "Slots" | "Keno";

export type CasinoGameDef = {
  key: CasinoGameKey;
  label: string; // shown to players
  price: number; // cost to buy an unowned casino
  topMultiplier: number; // biggest payout multiplier (keep in sync with casino.ts)
};

// To make another game ownable later, add it here and call runWager() from its route.
export const CASINO_GAMES: CasinoGameDef[] = [
  { key: "Slots", label: "Slot Machines", price: 25_000, topMultiplier: 500 },
  { key: "Keno", label: "Keno", price: 25_000, topMultiplier: 10_000 }
];

export function casinoDef(key: string): CasinoGameDef {
  return CASINO_GAMES.find((g) => g.key === key) ?? CASINO_GAMES[0];
}

// Max bet of a house-run casino, and the starting max bet of a newly bought one.
export const HOUSE_MAX_BET = 5_000;
export const ABSOLUTE_MAX_BET = 1_000_000;

export const FACTORY = {
  price: 250_000, // cost to buy an unowned factory
  steelCost: 10_000, // charged to the owner's cash on hand for every batch
  batchSize: 1_000, // bullets produced per batch
  intervalMs: 30 * 60 * 1000, // one batch every 30 minutes
  defaultPrice: 25, // starting price per bullet
  maxPrice: 10_000,
  maxCatchUpRuns: 200 // most batches settled in a single catch-up
};

// Shown next to an owner's name, based on their cash on hand.
export function wealthLabel(cash: number): string {
  if (cash < 100) return "Penniless";
  if (cash < 1_000) return "Down on Their Luck";
  if (cash < 10_000) return "Getting By";
  if (cash < 50_000) return "Comfortable";
  if (cash < 250_000) return "Well-Off";
  if (cash < 1_000_000) return "Rich";
  if (cash < 5_000_000) return "Very Rich";
  if (cash < 25_000_000) return "Excessively Rich";
  return "Incredibly Rich";
}

export type CasinoView = {
  id: string;
  city: string;
  game: string;
  label: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerWealth: string | null;
  maxBet: number;
  price: number;
  topMultiplier: number;
  isMine: boolean;
  // Only sent to the owner:
  profit?: number;
  plays?: number;
  wagered?: number;
  ownerCash?: number;
};

export type FactoryView = {
  id: string;
  city: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerWealth: string | null;
  stock: number;
  pricePerBullet: number;
  price: number;
  steelCost: number;
  batchSize: number;
  intervalMs: number;
  isMine: boolean;
  nextRunAt: string | null;
  // Only sent to the owner:
  ownerCash?: number;
  totalProduced?: number;
  revenue?: number;
};

export type VenueData = {
  currentCity: string;
  me: { money: number; bullets: number };
  casinos: CasinoView[];
  factories: FactoryView[];
};
