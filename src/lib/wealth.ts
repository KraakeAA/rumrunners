// Wealth status, worked out from cash plus bank.
export type Wealth = { min: number; name: string };

export const WEALTH_LEVELS: Wealth[] = [
  { min: 0, name: "Bankrupt" },
  { min: 10_000, name: "Lower Class" },
  { min: 30_000, name: "Middle Class" },
  { min: 100_000, name: "Upper Class" },
  { min: 300_000, name: "Wealthy" },
  { min: 1_000_000, name: "Millionaire" },
  { min: 3_000_000, name: "Multi-Millionaire" },
  { min: 10_000_000, name: "Excessively Rich" },
  { min: 30_000_000, name: "Incredibly Rich" },
  { min: 100_000_000, name: "Dangerously Rich" },
  { min: 300_000_000, name: "Notoriously Rich" }
];

// Being this rich makes you a target: it breaks the new-player shield.
export const SHIELD_BREAK_WEALTH = 300_000_000;

export function wealthStatus(cash: number, bank: number): string {
  const total = Math.max(0, cash + bank);
  let name = WEALTH_LEVELS[0].name;
  for (const level of WEALTH_LEVELS) {
    if (total >= level.min) name = level.name;
  }
  return name;
}
