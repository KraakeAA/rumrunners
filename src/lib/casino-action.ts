
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

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

      const payout = Math.floor(bet * multiplier);

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
