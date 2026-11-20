import type { Prisma } from "@prisma/client";

// Takes a lock on a player's row for the rest of the transaction. Two requests from
// the same player (for example, the same button fired many times at once) then run
// one after the other instead of both reading the same cash, energy or cooldown
// and both being paid. Call it first thing inside prisma.$transaction.
export async function lockPlayer(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "Player" WHERE "userId" = ${userId} FOR UPDATE`;
}

export async function lockPlayerId(tx: Prisma.TransactionClient, playerId: string) {
  await tx.$queryRaw`SELECT id FROM "Player" WHERE id = ${playerId} FOR UPDATE`;
}
