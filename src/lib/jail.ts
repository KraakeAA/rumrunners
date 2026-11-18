import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient;

// Seconds left on a sentence (0 when free).
export function jailRemaining(until: Date | null | undefined, now = new Date()): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

// A bigger job means a longer sentence in a tougher cell.
export function sentenceFor(energyCost: number): { seconds: number; security: number } {
  return {
    seconds: (2 + energyCost * 2) * 60,
    security: Math.min(5, Math.max(1, energyCost))
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
