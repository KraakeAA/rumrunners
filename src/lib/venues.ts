import { wealthStatus } from "@/lib/wealth";

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

export type CasinoGameKey = "Slots" | "Keno" | "Blackjack" | "Roulette" | "War";

export type CasinoGameDef = {
  key: CasinoGameKey;
  label: string; // shown to players
  price: number; // cost to buy an unowned casino
  topMultiplier: number; // biggest payout multiplier (keep in sync with casino.ts)
};

// To make another game ownable later, add it here and call runWager() from its route.
export const CASINO_GAMES: CasinoGameDef[] = [
  { key: "Slots", label: "Slot Machines", price: 2_500, topMultiplier: 500 },
  { key: "Keno", label: "Keno", price: 2_500, topMultiplier: 10_000 },
  { key: "Blackjack", label: "Blackjack", price: 2_500, topMultiplier: 2.5 },
  { key: "Roulette", label: "Roulette", price: 2_500, topMultiplier: 36 },
  { key: "War", label: "War", price: 2_500, topMultiplier: 2 }
];

export function casinoDef(key: string): CasinoGameDef {
  return CASINO_GAMES.find((g) => g.key === key) ?? CASINO_GAMES[0];
}

// Max bet of a house-run casino, and the starting max bet of a newly bought one.
export const HOUSE_MAX_BET = 500;

// War is always run by the house and can never be bought. Its stakes and wins
// are the way money goes into and out of the game, so its limit is higher.
export const HOUSE_ONLY_GAMES: string[] = ["War"];
export const WAR_MAX_BET = 100_000;
export const isHouseOnly = (game: string) => HOUSE_ONLY_GAMES.includes(game);
export const houseMaxBet = (game: string) => (game === "War" ? WAR_MAX_BET : HOUSE_MAX_BET);
export const ABSOLUTE_MAX_BET = 1_000_000;

export const FACTORY = {
  price: 25_000, // cost to buy an unowned factory
  steelCost: 1_000, // charged to the owner's cash on hand for every batch
  batchSize: 1_000, // bullets produced per batch
  intervalMs: 30 * 60 * 1000, // one batch every 30 minutes
  defaultPrice: 3, // starting price per bullet
  maxPrice: 1_000,
  maxCatchUpRuns: 200 // most batches settled in a single catch-up
};

// Shown next to an owner's name, based on their cash on hand.
export function wealthLabel(cash: number): string {
  return wealthStatus(cash, 0);
}

// How long a casino stays shut after a new owner takes it, so they can stock it.
export const OPENING_WINDOW_MS = 5 * 60 * 1000;

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
  // When a newly owned casino opens for play (ISO time), if it is still shut.
  openAt: string | null;
  // Only sent to the owner:
  chips?: number;
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
