import type { Prisma } from "@prisma/client";
import { rankForLevel } from "@/lib/ranks";

type Db = Prisma.TransactionClient;

// Sends the player a letter when they have been promoted.
export async function notifyPromotion(
  tx: Db,
  playerId: string,
  oldLevel: number,
  newLevel: number
) {
  if (newLevel <= oldLevel) return;

  const rank = rankForLevel(newLevel);

  await tx.message.create({
    data: {
      toId: playerId,
      fromName: "The Underworld",
      subject: "You were promoted",
      body: `You were promoted to ${rank}. Harder jobs and bigger rewards are open to you now, and your energy tank has grown.`
    }
  });
}
