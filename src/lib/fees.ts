// The game takes 10% of any money that moves from one player to another
// (sending cash, Escrow, the Marketplace). The fee is destroyed, which keeps money scarce.
// Buying from the game, banking and the casinos carry no fee.
export const TRANSFER_FEE = 0.1;

// What the receiver gets, and what the fee was, for an amount one player sends another.
export function splitTransfer(amount: number): { received: number; fee: number } {
  const fee = Math.floor(amount * TRANSFER_FEE);
  return { received: amount - fee, fee };
}
