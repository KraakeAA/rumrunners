import type { Prisma } from "@prisma/client";

type Db = Pick<Prisma.TransactionClient, "casino" | "player" | "message" | "statement">;

const ONLINE_MS = 5 * 60 * 1000;

// A dead owner's casinos go back on the market at once. Anything held in escrow is left to the escrow agent.
// The chips are paid to the dead player's cash, the same as dropping the casino by hand.
export async function dropCasinosOf(tx: Db, playerId: string) {
  const owned = await tx.casino.findMany({ where: { ownerId: playerId, escrowId: null } });
  let chips = 0;
  for (const c of owned) {
    const released = await tx.casino.updateMany({
      where: { id: c.id, ownerId: playerId },
      data: { ownerId: null, ownedSince: null, openAt: null, chips: 0, maxBet: 500, profit: 0, plays: 0, wagered: 0 }
    });
    if (released.count === 1) chips += c.chips;
  }
  if (chips > 0) await tx.player.update({ where: { id: playerId }, data: { money: { increment: chips } } });
}

// Sent to players who were in the city, and online, when someone was shot dead. Two to four of them,
// picked at random. Each gets a closed witness statement: a tradeable item that names the killer once opened.
export async function sendWitnessStatements(
  tx: Db,
  opts: { city: string; victimId: string; victimName: string; killer: { id: string; username: string } }
) {
  const crowd = await tx.player.findMany({
    where: {
      currentCity: opts.city,
      health: { gt: 0 },
      id: { notIn: [opts.victimId, opts.killer.id] },
      updatedAt: { gte: new Date(Date.now() - ONLINE_MS) }
    },
    select: { id: true }
  });
  if (crowd.length === 0) return;

  const count = 2 + Math.floor(Math.random() * 3); // 2 to 4
  const witnesses = crowd.sort(() => Math.random() - 0.5).slice(0, count);

  for (const w of witnesses) {
    await tx.statement.create({
      data: { ownerId: w.id, killerName: opts.killer.username, victimName: opts.victimName, city: opts.city }
    });
    await tx.message.create({
      data: {
        toId: w.id,
        fromName: "A Witness",
        subject: `You witnessed a shooting in ${opts.city}`,
        body: `You witnessed ${opts.victimName} get gunned down in ${opts.city}. See who it was: your witness statement is under Whack, in the Witness Statements tab. You can open it, leave it closed, or trade it through Escrow.`
      }
    });
  }
}
