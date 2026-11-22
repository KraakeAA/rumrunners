// While a game is still showing its result (the roulette wheel is spinning, say),
// the live balance check must not show the winnings early. The game holds the
// balance, and releases it once the result is on screen.

let heldUntil = 0;

export function holdBalance(ms = 8000) {
  heldUntil = Date.now() + ms;
}

export function releaseBalance() {
  heldUntil = 0;
}

export function isBalanceHeld() {
  return Date.now() < heldUntil;
}
