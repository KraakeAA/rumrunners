// Bootlegging: eight kinds of booze, with a low and a high price in every city.
// For now each city has one fixed price per booze (the middle of its range).
// Switch PRICES_FLUCTUATE on later to make prices drift every few minutes, the
// same for every player. Pure data, safe for server and browser.

export const PRICES_FLUCTUATE = false;

export const BOOZE_CITIES = ["London", "Birmingham", "Manchester", "Liverpool", "Glasgow"] as const;

// "c" = cheap here, "n" = normal, "d" = dear.
type Band = "c" | "n" | "d";

export type Booze = {
  key: string;
  name: string;
  base: number; // typical price of one crate, £
  bands: Record<string, Band>;
};

const band = (london: Band, birmingham: Band, manchester: Band, liverpool: Band, glasgow: Band) => ({
  London: london,
  Birmingham: birmingham,
  Manchester: manchester,
  Liverpool: liverpool,
  Glasgow: glasgow
});

export const BOOZES: Booze[] = [
  { key: "scotch", name: "Scotch Whisky", base: 120, bands: band("d", "n", "n", "n", "c") },
  { key: "irish", name: "Irish Whiskey", base: 110, bands: band("d", "d", "n", "c", "n") },
  { key: "gin", name: "London Gin", base: 70, bands: band("c", "n", "n", "d", "d") },
  { key: "rum", name: "Navy Rum", base: 90, bands: band("n", "d", "n", "c", "d") },
  { key: "brandy", name: "French Brandy", base: 160, bands: band("n", "d", "d", "c", "n") },
  { key: "champagne", name: "Champagne", base: 220, bands: band("c", "d", "d", "n", "d") },
  { key: "stout", name: "Irish Stout", base: 40, bands: band("n", "d", "n", "c", "n") },
  { key: "port", name: "Port Wine", base: 100, bands: band("n", "c", "d", "n", "d") }
];

const RANGE: Record<Band, [number, number]> = {
  c: [0.55, 0.8],
  n: [0.9, 1.15],
  d: [1.3, 1.7]
};

export function boozeByKey(key: string): Booze | undefined {
  return BOOZES.find((b) => b.key === key);
}

// The lowest and highest a crate can cost in a city.
export function boozeRange(b: Booze, city: string): { low: number; high: number } {
  const [lo, hi] = RANGE[b.bands[city] ?? "n"];
  return { low: Math.round(b.base * lo), high: Math.round(b.base * hi) };
}

export const PRICE_MINUTES = 10; // how often prices change, once they do

// A small stable hash so every player sees the same price at the same time.
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

export function boozePrice(b: Booze, city: string, now = Date.now()): number {
  const { low, high } = boozeRange(b, city);
  if (!PRICES_FLUCTUATE) return Math.round((low + high) / 2);
  const bucket = Math.floor(now / (PRICE_MINUTES * 60_000));
  const u = hash01(`${city}|${b.key}|${bucket}`);
  return Math.round(low + (high - low) * u);
}

export type Cargo = Record<string, number>;

export function cargoOf(value: unknown): Cargo {
  const out: Cargo = {};
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const n = Math.floor(Number(v));
      if (boozeByKey(k) && n > 0) out[k] = n;
    }
  }
  return out;
}

export const cargoTotal = (c: Cargo) => Object.values(c).reduce((n, x) => n + x, 0);
