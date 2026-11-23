import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const MAX_ITEMS_PER_SIDE = 10;
export const MAX_OPEN_ESCROWS = 5;
export const MAX_AMOUNT = 2_000_000_000;
export const ESCROW_MINUTES = 30;
export const escrowDeadline = (from = new Date()) => new Date(from.getTime() + ESCROW_MINUTES * 60_000);

// Give everything the agent is holding back to whoever put it in.
export async function releaseItems(tx: Tx, escrowId: string) {
  const items = await tx.escrowItem.findMany({ where: { escrowId } });
  for (const item of items) {
    if (item.kind === "cash") {
      await tx.player.update({ where: { id: item.ownerId }, data: { money: { increment: item.amount } } });
    } else if (item.kind === "gold") {
      await tx.player.update({ where: { id: item.ownerId }, data: { gold: { increment: item.amount } } });
    } else if (item.kind === "car" && item.carId) {
      await tx.car.updateMany({ where: { id: item.carId }, data: { escrowId: null } });
    } else if (item.kind === "casino" && item.casinoId) {
      await tx.casino.updateMany({ where: { id: item.casinoId }, data: { escrowId: null } });
    } else if (item.kind === "statement" && item.statementId) {
      await tx.statement.updateMany({ where: { id: item.statementId }, data: { escrowId: null } });
    }
  }
  await tx.escrowItem.deleteMany({ where: { escrowId } });
}

export async function cancelEscrow(tx: Tx, escrowId: string) {
  await releaseItems(tx, escrowId);
  await tx.escrow.update({
    where: { id: escrowId },
    data: { status: "cancelled", aLocked: false, bLocked: false, aAgreed: false, bAgreed: false }
  });
}

// Used when a player starts a new life: every open escrow they are in is cancelled.
export async function cancelEscrowsFor(tx: Tx, playerId: string) {
  const open = await tx.escrow.findMany({
    where: { status: { in: ["invited", "active"] }, OR: [{ aId: playerId }, { bId: playerId }] },
    select: { id: true }
  });
  for (const e of open) await cancelEscrow(tx, e.id);
}

// If the escrow has run out of time, cancel it and give everything back. Returns true if it is now closed.
export async function expireEscrowIfStale(tx: Tx, escrowId: string, now = new Date()): Promise<boolean> {
  const e = await tx.escrow.findUnique({ where: { id: escrowId } });
  if (!e || (e.status !== "invited" && e.status !== "active")) return true;
  if (e.expiresAt && e.expiresAt.getTime() <= now.getTime()) {
    await cancelEscrow(tx, escrowId);
    return true;
  }
  return false;
}

// Closes every out-of-time escrow a player is in. Cheap enough to call whenever they load a page.
export async function expireEscrowsFor(client: PrismaClient, playerId: string) {
  const stale = await client.escrow.findMany({
    where: {
      status: { in: ["invited", "active"] },
      expiresAt: { lte: new Date() },
      OR: [{ aId: playerId }, { bId: playerId }]
    },
    select: { id: true }
  });
  for (const e of stale) {
    await client.$transaction(async (tx: Tx) => {
      await expireEscrowIfStale(tx, e.id);
    });
  }
  return stale.length;
}
