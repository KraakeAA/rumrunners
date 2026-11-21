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

// Slots work like a real machine: the result is picked first from the table below, then three
// reels are laid out to show it. That keeps the prizes big and the machine fair to its owner.
// Chances are out of 1,000,000. Together the prizes pay back 90% of what is staked, so an
// owner earns about 10% over time. The big prizes are deliberately hard to hit: 777 is
// 1 spin in 10,000 and BAR BAR BAR 1 in 5,000.
//   777 500x (100) · BAR BAR BAR 100x (200) · three oranges 50x (2,500) · three cherries 20x (5,000)
//   two 7s 10x (8,000) · a single 7 5x (40,000) · two cherries 2x, anywhere (162,500)
const SLOT_TABLE: { upTo: number; multiplier: number; combination: string; make: () => string[] }[] = [];
{
  const others = ["🍒", "🍊", "BAR"];
  const pickOf = (list: string[]) => list[randomInt(list.length)];
  const shuffle = (list: string[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  let total = 0;
  const add = (chance: number, multiplier: number, combination: string, make: () => string[]) => {
    total += chance;
    SLOT_TABLE.push({ upTo: total, multiplier, combination, make });
  };
  add(100, 500, "777", () => ["7", "7", "7"]);
  add(200, 100, "BAR BAR BAR", () => ["BAR", "BAR", "BAR"]);
  add(2_500, 50, "Orange Orange Orange", () => ["🍊", "🍊", "🍊"]);
  add(5_000, 20, "Cherry Cherry Cherry", () => ["🍒", "🍒", "🍒"]);
  add(8_000, 10, "77", () => shuffle(["7", "7", pickOf(others)]));
  add(40_000, 5, "A 7", () => shuffle(["7", pickOf(others), pickOf(others)]));
  add(162_500, 2, "Two cherries", () => shuffle(["🍒", "🍒", pickOf(["🍊", "BAR"])]));
}

// A losing spin: no 7, no three of a kind and at most one cherry.
function losingReels(): string[] {
  const shapes = [
    ["🍒", "🍊", "BAR"],
    ["🍊", "🍊", "BAR"],
    ["🍊", "BAR", "BAR"],
    ["🍒", "🍊", "🍊"],
    ["🍒", "BAR", "BAR"]
  ];
  const reels = [...shapes[randomInt(shapes.length)]];
  for (let i = reels.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [reels[i], reels[j]] = [reels[j], reels[i]];
  }
  return reels;
}

export function spinSlots() {
  const roll = randomInt(1_000_000);
  const hit = SLOT_TABLE.find((row) => roll < row.upTo);

  if (!hit) {
    return { reels: losingReels(), multiplier: 0, combination: "No win" };
  }
  return { reels: hit.make(), multiplier: hit.multiplier, combination: hit.combination };
}

/* ------------------------------- Roulette ------------------------------- */
// European single-zero wheel: 0-36.

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const ROULETTE_BETS = [
  "number", "red", "black", "odd", "even", "low", "high",
  "dozen1", "dozen2", "dozen3", "col1", "col2", "col3"
] as const;

export type RouletteBet = (typeof ROULETTE_BETS)[number];

export function rouletteColour(n: number): "green" | "red" | "black" {
  return n === 0 ? "green" : RED.has(n) ? "red" : "black";
}

export function spinRoulette(type: string, number?: number) {
  if (!ROULETTE_BETS.includes(type as RouletteBet)) {
    throw new Error("Choose a bet on the table.");
  }
  if (type === "number" && (!Number.isInteger(number) || (number as number) < 0 || (number as number) > 36)) {
    throw new Error("Pick a number from 0 to 36.");
  }

  const result = randomInt(37);
  const colour = rouletteColour(result);
  let win = false;
  let multiplier = 0;

  switch (type) {
    case "number": win = result === number; multiplier = 36; break;
    case "red": win = colour === "red"; multiplier = 2; break;
    case "black": win = colour === "black"; multiplier = 2; break;
    case "odd": win = result !== 0 && result % 2 === 1; multiplier = 2; break;
    case "even": win = result !== 0 && result % 2 === 0; multiplier = 2; break;
    case "low": win = result >= 1 && result <= 18; multiplier = 2; break;
    case "high": win = result >= 19 && result <= 36; multiplier = 2; break;
    case "dozen1": win = result >= 1 && result <= 12; multiplier = 3; break;
    case "dozen2": win = result >= 13 && result <= 24; multiplier = 3; break;
    case "dozen3": win = result >= 25 && result <= 36; multiplier = 3; break;
    case "col1": win = result !== 0 && result % 3 === 1; multiplier = 3; break;
    case "col2": win = result !== 0 && result % 3 === 2; multiplier = 3; break;
    case "col3": win = result !== 0 && result % 3 === 0; multiplier = 3; break;
  }

  return { result, colour, betType: type, betNumber: number ?? null, win, multiplier: win ? multiplier : 0 };
}


// What a single roulette bet pays (stake included) for a given result, or 0 if it loses.
export function rouletteMultiplier(type: string, number: number | undefined, result: number): number {
  const colour = rouletteColour(result);
  switch (type) {
    case "number": return result === number ? 36 : 0;
    case "red": return colour === "red" ? 2 : 0;
    case "black": return colour === "black" ? 2 : 0;
    case "odd": return result !== 0 && result % 2 === 1 ? 2 : 0;
    case "even": return result !== 0 && result % 2 === 0 ? 2 : 0;
    case "low": return result >= 1 && result <= 18 ? 2 : 0;
    case "high": return result >= 19 && result <= 36 ? 2 : 0;
    case "dozen1": return result >= 1 && result <= 12 ? 3 : 0;
    case "dozen2": return result >= 13 && result <= 24 ? 3 : 0;
    case "dozen3": return result >= 25 && result <= 36 ? 3 : 0;
    case "col1": return result !== 0 && result % 3 === 1 ? 3 : 0;
    case "col2": return result !== 0 && result % 3 === 2 ? 3 : 0;
    case "col3": return result !== 0 && result % 3 === 0 ? 3 : 0;
    default: return 0;
  }
}

export type RouletteStake = { type: string; number?: number; amount: number };

// One spin of the wheel, settling every bet placed on the table.
export function spinRouletteTable(stakes: RouletteStake[]) {
  if (!Array.isArray(stakes) || stakes.length === 0 || stakes.length > 60) {
    throw new Error("Place a bet on the table first.");
  }
  for (const b of stakes) {
    if (!ROULETTE_BETS.includes(b.type as RouletteBet)) throw new Error("Choose a bet on the table.");
    if (b.type === "number" && (!Number.isInteger(b.number) || (b.number as number) < 0 || (b.number as number) > 36)) {
      throw new Error("Pick a number from 0 to 36.");
    }
    if (!Number.isSafeInteger(b.amount) || b.amount < 1) throw new Error("Every chip needs a whole-pound amount.");
  }

  const result = randomInt(37);
  const colour = rouletteColour(result);
  const bets = stakes.map((b) => {
    const payout = b.amount * rouletteMultiplier(b.type, b.number, result);
    return { type: b.type, number: b.type === "number" ? b.number ?? null : null, amount: b.amount, win: payout > 0, payout };
  });
  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
  const totalPayout = bets.reduce((sum, b) => sum + b.payout, 0);

  return { result, colour, bets, totalBet, totalPayout };
}

/* --------------------------------- Cards -------------------------------- */

export type Card = { r: number; s: number }; // r: 1 (ace) to 13 (king), s: 0-3

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/* ---------------------------------- War --------------------------------- */
// Ace is high. A tie goes to war: one more card each, and the player wins
// the war on a tie or better. A won war pays 1.5x the bet.

const warValue = (c: Card) => (c.r === 1 ? 14 : c.r);

export function playWar() {
  const deck = freshDeck();
  const player = deck[0];
  const dealer = deck[1];
  const a = warValue(player);
  const b = warValue(dealer);

  if (a !== b) {
    return { player, dealer, war: false, warPlayer: null, warDealer: null, win: a > b, multiplier: a > b ? 2 : 0 };
  }

  const warPlayer = deck[8];
  const warDealer = deck[9];
  const win = warValue(warPlayer) >= warValue(warDealer);
  return { player, dealer, war: true, warPlayer, warDealer, win, multiplier: win ? 1.5 : 0 };
}

/* ------------------------------- Blackjack ------------------------------ */

export function handValue(hand: Card[]) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.r === 1) { aces++; total += 11; }
    else total += Math.min(c.r, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export const isBlackjack = (hand: Card[]) => hand.length === 2 && handValue(hand) === 21;

// Dealer stands on all 17s. Returns the dealer's finished hand.
export function dealerPlay(dealer: Card[], deck: Card[]) {
  const hand = [...dealer];
  const rest = [...deck];
  while (handValue(hand) < 17) hand.push(rest.shift() as Card);
  return { hand, rest };
}

// Multiplier of the bet returned: 0 lose, 1 push, 2 win, 2.5 blackjack.
export function blackjackResult(player: Card[], dealer: Card[]) {
  const p = handValue(player);
  const d = handValue(dealer);
  if (p > 21) return { multiplier: 0, label: "Bust" };
  if (isBlackjack(player) && !isBlackjack(dealer)) return { multiplier: 2.5, label: "Blackjack!" };
  if (isBlackjack(dealer) && !isBlackjack(player)) return { multiplier: 0, label: "Dealer has blackjack" };
  if (d > 21) return { multiplier: 2, label: "Dealer busts" };
  if (p > d) return { multiplier: 2, label: "You win" };
  if (p === d) return { multiplier: 1, label: "Push" };
  return { multiplier: 0, label: "Dealer wins" };
}
