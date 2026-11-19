import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { HOUSE_MAX_BET } from "@/lib/venues";
import { expireEscrowIfStale } from "@/lib/escrow";

type Tx = Prisma.TransactionClient;

export function validBet(bet: number) {
  return Number.isSafeInteger(bet) && bet >= 1 && bet <= 1_000_000;
}

// Finds (or creates) the casino in the player's city and checks they may play there.
async function openTable(tx: Tx, userId: string, game: string, bet: number) {
  const player = await tx.player.findUnique({ where: { userId } });
  if (!player) throw new Error("PLAYER_NOT_FOUND");
  if (player.jailUntil && player.jailUntil.getTime() > Date.now()) throw new Error("JAILED");

  const city = player.currentCity || "London";
  await tx.casino.createMany({ data: [{ city, game, maxBet: HOUSE_MAX_BET }], skipDuplicates: true });
  const casino = await tx.casino.findUnique({ where: { city_game: { city, game } } });
  if (!casino) throw new Error("CASINO_NOT_FOUND");
  if (casino.ownerId === player.id) throw new Error("OWN_CASINO");

  // A casino held by the Escrow agent is shut. If its trade has run out of time it is released first.
  if (casino.escrowId) {
    const released = await expireEscrowIfStale(tx, casino.escrowId);
    if (!released) throw new Error("IN_ESCROW");
  }

  const limit = casino.ownerId ? casino.maxBet : HOUSE_MAX_BET;
  if (bet > limit) throw new Error("OVER_MAX_BET:" + limit);

  return { player, casino, city };
}

async function takeBet(tx: Tx, playerId: string, bet: number) {
  const debit = await tx.player.updateMany({
    where: { id: playerId, money: { gte: bet } },
    data: { money: { decrement: bet } }
  });
  if (debit.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
}

// Pays out a finished game. If `prepaid` the bet has already been taken from the player.
async function settle(
  tx: Tx,
  player: { id: string },
  casino: { id: string; ownerId: string | null },
  game: string,
  bet: number,
  multiplier: number,
  outcome: Record<string, unknown>,
  prepaid: boolean,
  city: string
) {
  if (!prepaid) await takeBet(tx, player.id, bet);

  let payout = Math.floor(bet * multiplier);
  let takeover = false;
  let previousOwner: string | null = null;

  if (casino.ownerId) {
    // The owner's cash on hand is the bank. The stake goes to them first.
    await tx.player.update({ where: { id: casino.ownerId }, data: { money: { increment: bet } } });

    if (payout > 0) {
      const covered = await tx.player.updateMany({
        where: { id: casino.ownerId, money: { gte: payout } },
        data: { money: { decrement: payout } }
      });

      if (covered.count !== 1) {
        // Owner cannot cover the win: the player takes everything they have and the casino changes hands.
        const owner = await tx.player.findUnique({
          where: { id: casino.ownerId },
          select: { money: true, username: true }
        });
        payout = owner?.money ?? 0;
        previousOwner = owner?.username ?? null;
        await tx.player.update({ where: { id: casino.ownerId }, data: { money: 0 } });
        takeover = true;
      }
    }

    const net = bet - payout;
    await tx.casino.update({
      where: { id: casino.id },
      data: takeover
        ? { ownerId: player.id, ownedSince: new Date(), profit: 0, plays: 0, wagered: 0 }
        : { profit: { increment: net }, plays: { increment: 1 }, wagered: { increment: bet } }
    });
  } else {
    await tx.casino.update({
      where: { id: casino.id },
      data: { plays: { increment: 1 }, wagered: { increment: bet } }
    });
  }

  const updated = await tx.player.update({
    where: { id: player.id },
    data: { money: { increment: payout } }
  });

  await tx.casinoLog.create({
    data: { playerId: player.id, game, bet, payout, outcome: outcome as unknown as Prisma.InputJsonValue }
  });

  return { money: updated.money, bet, payout, net: payout - bet, takeover, previousOwner, city };
}

export function wagerError(error: unknown, game: string) {
  const message = error instanceof Error ? error.message : "";

  if (message === "JAILED")
    return NextResponse.json({ error: "There is no gambling from a prison cell." }, { status: 403 });
  if (message === "INSUFFICIENT_FUNDS")
    return NextResponse.json({ error: "You do not have enough cash." }, { status: 400 });
  if (message === "OWN_CASINO")
    return NextResponse.json({ error: "You own this casino. Open its control page instead." }, { status: 400 });
  if (message === "IN_ESCROW")
    return NextResponse.json({ error: "This casino is being sold through Escrow and is closed until the trade ends." }, { status: 400 });
  if (message === "HAND_IN_PLAY")
    return NextResponse.json({ error: "Finish your current hand first." }, { status: 400 });
  if (message === "NO_HAND")
    return NextResponse.json({ error: "There is no hand in play." }, { status: 400 });
  if (message.startsWith("OVER_MAX_BET:")) {
    const limit = Number(message.split(":")[1]);
    return NextResponse.json(
      { error: `The maximum bet here is £${limit.toLocaleString("en-GB")}.` },
      { status: 400 }
    );
  }
  if (message === "PLAYER_NOT_FOUND")
    return NextResponse.json({ error: "Player not found." }, { status: 404 });

  console.error(`${game} wager failed:`, error);
  return NextResponse.json(
    { error: "The game could not be completed. Your cash has not been charged." },
    { status: 500 }
  );
}

// One-shot games (slots, keno, roulette, war): stake, result and payout in one go.
export async function runWager(
  game: string,
  bet: number,
  outcome: Record<string, unknown>,
  multiplier: number
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  if (!validBet(bet))
    return NextResponse.json({ error: "Enter a bet between £1 and £1,000,000." }, { status: 400 });
  if (!Number.isFinite(multiplier) || multiplier < 0)
    return NextResponse.json({ error: "Invalid game result." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const { player, casino, city } = await openTable(tx, userId, game, bet);
      return settle(tx, player, casino, game, bet, multiplier, outcome, false, city);
    });
    return NextResponse.json({ ...result, ...outcome });
  } catch (error) {
    return wagerError(error, game);
  }
}

// Multi-step games (blackjack): the bet is taken when the hand starts...
export async function startEscrow(tx: Tx, userId: string, game: string, bet: number) {
  const { player, city } = await openTable(tx, userId, game, bet);
  await takeBet(tx, player.id, bet);
  return { player, city };
}

// ...and paid out when it ends. The casino is the one in the city where the hand began.
export async function finishEscrow(
  tx: Tx,
  playerId: string,
  game: string,
  city: string,
  bet: number,
  multiplier: number,
  outcome: Record<string, unknown>
) {
  await tx.casino.createMany({ data: [{ city, game, maxBet: HOUSE_MAX_BET }], skipDuplicates: true });
  const casino = await tx.casino.findUnique({ where: { city_game: { city, game } } });
  if (!casino) throw new Error("CASINO_NOT_FOUND");

  // If the owner is the player themselves (bought it mid-hand) treat it as a house game.
  const house = casino.ownerId === playerId ? { id: casino.id, ownerId: null } : casino;
  return settle(tx, { id: playerId }, house, game, bet, multiplier, outcome, true, city);
}
