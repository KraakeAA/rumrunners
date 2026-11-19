// Bounties on the Hitlist. Adding a target costs the bounty plus a 5% fee that is destroyed.
export const BOUNTY_FEE = 0.05;
export const BOUNTY_MIN = 10;
export const REASON_MAX = 150;

export function bountyFee(amount: number): number {
  return Math.max(1, Math.ceil(amount * BOUNTY_FEE));
}
