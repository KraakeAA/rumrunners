import { NextResponse } from "next/server";
import { lockPlayer } from "@/lib/lock";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { HOUSE_MAX_BET, OPENING_WINDOW_MS, houseMaxBet, isHouseOnly } from "@/lib/venues";
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
  await tx.casino.createMany({ data: [{ city, game, maxBet: houseMaxBet(game) }], skipDuplicates: true });
  const found = await tx.casino.findUnique({ where: { city_game: { city, game } } });
  if (!found) throw new Error("CASINO_NOT_FOUND");

  // War is always the house: no owner, no escrow, a fixed limit.
  if (isHouseOnly(game)) {
    if (bet > houseMaxBet(game)) throw new Error("OVER_MAX_BET:" + houseMaxBet(game));
    return { player, casino: { ...found, ownerId: null, escrowId: null }, city };
  }

  const casino = found;
  if (casino.ownerId === player.id) throw new Error("OWN_CASINO");

  // A casino nobody owns is shut: it can only be bought, never played.
  if (!casino.ownerId) throw new Error("NO_OWNER");

  // A casino held by the Escrow agent is shut. If its trade has run out of time it is released first.
  if (casino.escrowId) {
    const released = await expireEscrowIfStale(tx, casino.escrowId);
    if (!released) throw new Error("IN_ESCROW");
  }

  // A player-owned casino stays shut for a few minutes after a change of owner,
  // and can only take bets its chips can stand behind.
  if (casino.ownerId) {
    if (casino.openAt && casino.openAt.getTime() > Date.now()) {
      throw new Error("CASINO_OPENING:" + Math.ceil((casino.openAt.getTime() - Date.now()) / 1000));
    }
    if (casino.chips < bet) throw new Error("CASINO_BROKE");
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
    // The casino's chips are the bank. The stake goes into the chips first.
    await tx.casino.update({ where: { id: casino.id }, data: { chips: { increment: bet } } });

    if (payout > 0) {
      const covered = await tx.casino.updateMany({
        where: { id: casino.id, chips: { gte: payout } },
        data: { chips: { decrement: payout } }
      });

      if (covered.count !== 1) {
        // The chips cannot cover the win: the player takes whatever is left.
        const left = await tx.casino.findUnique({ where: { id: casino.id }, select: { chips: true } });
        payout = left?.chips ?? 0;

        // The owner could not pay in full, so the player takes the casino over.
        const oldOwner = await tx.player.findUnique({ where: { id: casino.ownerId }, select: { id: true, username: true } });
        const winner = await tx.player.findUnique({ where: { id: player.id }, select: { username: true } });
        takeover = true;
        previousOwner = oldOwner?.username ?? null;
        await tx.casino.update({
          where: { id: casino.id },
          data: {
            ownerId: player.id,
            ownedSince: new Date(),
            chips: 0,
            openAt: new Date(Date.now() + OPENING_WINDOW_MS),
            maxBet: HOUSE_MAX_BET,
            profit: 0,
            plays: 0,
            wagered: 0
          }
        });
        if (oldOwner) {
          await tx.message.create({
            data: {
              toId: oldOwner.id,
              fromName: winner?.username ?? "Rumrunners",
              subject: "You lost your casino",
              body: `${winner?.username ?? "A player"} won more than your ${game} casino in ${city} could pay. You could not cover it, so they were paid what was left and now own the casino.`
            }
          });
        }
      }
    }

    if (!takeover) {
      const net = bet - payout;
      await tx.casino.update({
        where: { id: casino.id },
        data: { profit: { increment: net }, plays: { increment: 1 }, wagered: { increment: bet } }
      });
    }
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
  if (message === "NO_OWNER")
    return NextResponse.json({ error: "Nobody owns this casino. It is shut until someone buys it." }, { status: 400 });
  if (message === "IN_ESCROW")
    return NextResponse.json({ error: "This casino is being sold through Escrow and is closed until the trade ends." }, { status: 400 });
  if (message === "HAND_IN_PLAY")
    return NextResponse.json({ error: "Finish your current hand first." }, { status: 400 });
  if (message === "NO_HAND")
    return NextResponse.json({ error: "There is no hand in play." }, { status: 400 });
  if (message.startsWith("CASINO_OPENING:")) {
    const secs = Number(message.split(":")[1]) || 0;
    return NextResponse.json(
      { error: `This casino has a new owner and is still being stocked. It opens in ${Math.floor(secs / 60)}m ${secs % 60}s.` },
      { status: 400 }
    );
  }
  if (message === "CASINO_BROKE")
    return NextResponse.json({ error: "The casino doesn't have enough chips to cover that bet." }, { status: 400 });
  if (message.startsWith("OVER_MAX_BET:")) {
    const limit = Number(message.split(":")[1]);
    return NextResponse.json(
      { error: `The maximum bet here is £${limit.toLocaleString("en-GB")}.` },
      { status: 400 }
    );
  }
  if (message === "HOUSE_ONLY")
    return NextResponse.json({ error: "This table is always run by the house." }, { status: 400 });
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
      await lockPlayer(tx, userId);
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
