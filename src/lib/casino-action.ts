
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { HOUSE_MAX_BET } from "@/lib/venues";

export async function runWager(
  game: string,
  bet: number,
  outcome: Record<string, unknown>,
  multiplier: number
) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401 }
    );
  }

  if (
    !Number.isSafeInteger(bet) ||
    bet < 1 ||
    bet > 1000000
  ) {
    return NextResponse.json(
      { error: "Enter a bet between £1 and £1,000,000." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(multiplier) || multiplier < 0) {
    return NextResponse.json(
      { error: "Invalid game result." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({
        where: { userId },
      });

      if (!player) {
        throw new Error("PLAYER_NOT_FOUND");
      }

      const city = player.currentCity || "London";

      await tx.casino.createMany({
        data: [{ city, game, maxBet: HOUSE_MAX_BET }],
        skipDuplicates: true,
      });

      const casino = await tx.casino.findUnique({
        where: { city_game: { city, game } },
      });

      if (!casino) {
        throw new Error("CASINO_NOT_FOUND");
      }

      if (casino.ownerId === player.id) {
        throw new Error("OWN_CASINO");
      }

      const limit = casino.ownerId ? casino.maxBet : HOUSE_MAX_BET;

      if (bet > limit) {
        throw new Error("OVER_MAX_BET:" + limit);
      }

      const debit = await tx.player.updateMany({
        where: {
          id: player.id,
          money: { gte: bet },
        },
        data: {
          money: { decrement: bet },
        },
      });

      if (debit.count !== 1) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      let payout = Math.floor(bet * multiplier);
      let takeover = false;
      let previousOwner: string | null = null;

      if (casino.ownerId) {
        // The owner's cash on hand is the bank. The stake goes to them first.
        await tx.player.update({
          where: { id: casino.ownerId },
          data: { money: { increment: bet } },
        });

        if (payout > 0) {
          const covered = await tx.player.updateMany({
            where: { id: casino.ownerId, money: { gte: payout } },
            data: { money: { decrement: payout } },
          });

          if (covered.count !== 1) {
            // Owner cannot cover the win: the player takes everything they
            // have and the casino changes hands.
            const owner = await tx.player.findUnique({
              where: { id: casino.ownerId },
              select: { money: true, username: true },
            });
            payout = owner?.money ?? 0;
            previousOwner = owner?.username ?? null;
            await tx.player.update({
              where: { id: casino.ownerId },
              data: { money: 0 },
            });
            takeover = true;
          }
        }

        const net = bet - payout;

        await tx.casino.update({
          where: { id: casino.id },
          data: takeover
            ? {
                ownerId: player.id,
                ownedSince: new Date(),
                profit: 0,
                plays: 0,
                wagered: 0,
              }
            : {
                profit: { increment: net },
                plays: { increment: 1 },
                wagered: { increment: bet },
              },
        });
      } else {
        await tx.casino.update({
          where: { id: casino.id },
          data: { plays: { increment: 1 }, wagered: { increment: bet } },
        });
      }

      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          money: { increment: payout },
        },
      });

      await tx.casinoLog.create({
        data: {
          playerId: player.id,
          game,
          bet,
          payout,
          outcome: outcome as any,
        },
      });

      return {
        money: updated.money,
        bet,
        payout,
        net: payout - bet,
        takeover,
        previousOwner,
        city,
      };
    });

    return NextResponse.json({
      ...result,
      ...outcome,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "INSUFFICIENT_FUNDS") {
      return NextResponse.json(
        { error: "You do not have enough cash." },
        { status: 400 }
      );
    }

    if (message === "OWN_CASINO") {
      return NextResponse.json(
        { error: "You own this casino. Open its control page instead." },
        { status: 400 }
      );
    }

    if (message.startsWith("OVER_MAX_BET:")) {
      const limit = Number(message.split(":")[1]);
      return NextResponse.json(
        {
          error: `The maximum bet here is £${limit.toLocaleString("en-GB")}.`,
        },
        { status: 400 }
      );
    }

    if (message === "PLAYER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    console.error(`${game} wager failed:`, error);

    return NextResponse.json(
      {
        error:
          "The game could not be completed. Your cash has not been charged.",
      },
      { status: 500 }
    );
  }
}
