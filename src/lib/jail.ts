import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient;

// Seconds left on a sentence (0 when free).
export function jailRemaining(until: Date | null | undefined, now = new Date()): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

// A bigger job means a longer sentence in a tougher cell, and the sentences
// grow as you climb the ranks. "units" is the size of the job: 1 for the
// smallest crimes up to about 6 for the biggest. A rank 1 pickpocket gets 10
// seconds; a top-rank bullion heist gets several minutes.
export function sentenceFor(
  units: number,
  rankLevel: number
): { seconds: number; security: number } {
  const u = Math.max(1, units);
  const rankFactor = 1 + Math.max(0, rankLevel - 1) * 0.1;

  return {
    seconds: Math.round(10 * Math.pow(u, 1.7) * rankFactor),
    security: Math.min(5, Math.max(1, Math.round(u)))
  };
}

export async function sendToJail(
  tx: Db,
  playerId: string,
  seconds: number,
  security: number,
  reason: string,
  now = new Date()
) {
  await tx.player.update({
    where: { id: playerId },
    data: {
      jailUntil: new Date(now.getTime() + seconds * 1000),
      jailReason: reason,
      jailSecurity: security,
      selfBustUsed: false
    }
  });
}

export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));
