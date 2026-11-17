
import { randomInt } from "crypto";

export const KENO_PAYOUTS: Record<number, number> = {
  5: 5,
  6: 24,
  7: 142,
  8: 1000,
  9: 4500,
  10: 10000,
};

export function drawKeno(selected: number[]) {
  if (
    selected.length !== 10 ||
    new Set(selected).size !== 10 ||
    selected.some(
      (n) => !Number.isInteger(n) || n < 1 || n > 80
    )
  ) {
    throw new Error(
      "Choose exactly 10 different numbers from 1 to 80."
    );
  }

  const pool = Array.from({ length: 80 }, (_, i) => i + 1);

  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const drawn = pool.slice(0, 20).sort((a, b) => a - b);
  const matches = selected.filter((n) => drawn.includes(n)).length;
  const multiplier = KENO_PAYOUTS[matches] ?? 0;

  return { drawn, matches, multiplier };
}

const REEL_SYMBOLS = [
  { symbol: "🍒", weight: 30 },
  { symbol: "🍊", weight: 25 },
  { symbol: "BAR", weight: 18 },
  { symbol: "7", weight: 12 },
] as const;

function reelSymbol() {
  const total = REEL_SYMBOLS.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  let roll = randomInt(total);

  for (const item of REEL_SYMBOLS) {
    if (roll < item.weight) return item.symbol;
    roll -= item.weight;
  }

  return "🍒";
}

export function spinSlots() {
  const reels = [
    reelSymbol(),
    reelSymbol(),
    reelSymbol(),
  ];

  const counts = reels.reduce<Record<string, number>>(
    (acc, symbol) => {
      acc[symbol] = (acc[symbol] ?? 0) + 1;
      return acc;
    },
    {}
  );

  // One spin, one payout: highest qualifying award only.
  let multiplier = 0;
  let combination = "No win";

  if (counts["7"] === 3) {
    multiplier = 500;
    combination = "777";
  } else if (counts["BAR"] === 3) {
    multiplier = 100;
    combination = "BAR BAR BAR";
  } else if (counts["🍊"] === 3) {
    multiplier = 50;
    combination = "Orange Orange Orange";
  } else if (counts["🍒"] === 3) {
    multiplier = 20;
    combination = "Cherry Cherry Cherry";
  } else if (counts["7"] === 2) {
    multiplier = 10;
    combination = "77";
  } else if (counts["7"] >= 1) {
    multiplier = 5;
    combination = "A 7";
  } else if (counts["🍒"] >= 2) {
    multiplier = 2;
    combination = "Two cherries";
  }

  return { reels, multiplier, combination };
}
