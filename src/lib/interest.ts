// Bank interest: 3% every 24 hours. The clock restarts whenever the balance is added to or taken from.
export const INTEREST_RATE = 0.03;
export const INTEREST_MS = 24 * 60 * 60 * 1000;
const MAX_PERIODS = 30; // most days paid in one go for an account left alone

type Client = {
  player: {
    findUnique: (args: any) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    update: (args: any) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
};

export function interestOn(bank: number): number {
  return Math.floor(bank * INTEREST_RATE);
}

// Pays any interest that is due and starts the clock if it isn't running.
// Call this before changing a balance, and when showing it.
export async function settleInterest(
  db: Client,
  playerId: string,
  now = new Date()
): Promise<{ bank: number; bankSince: Date | null }> {
  const p = await db.player.findUnique({ where: { id: playerId }, select: { bank: true, bankSince: true } });
  if (!p) return { bank: 0, bankSince: null };

  if (p.bank <= 0) return { bank: p.bank, bankSince: p.bankSince };

  if (!p.bankSince) {
    await db.player.update({ where: { id: playerId }, data: { bankSince: now } });
    return { bank: p.bank, bankSince: now };
  }

  const periods = Math.min(MAX_PERIODS, Math.floor((now.getTime() - p.bankSince.getTime()) / INTEREST_MS));
  if (periods < 1) return { bank: p.bank, bankSince: p.bankSince };

  let bank = p.bank;
  for (let i = 0; i < periods; i++) bank += interestOn(bank);
  // Keep the leftover part of a day so the next payment stays on schedule.
  const stillWaiting = now.getTime() - p.bankSince.getTime() - periods * INTEREST_MS;
  const since = periods >= MAX_PERIODS ? now : new Date(now.getTime() - Math.max(0, stillWaiting));

  await db.player.update({ where: { id: playerId }, data: { bank, bankSince: since } });
  return { bank, bankSince: since };
}
