import { denyIfDead } from "@/lib/alive";
import { lockPlayer } from "@/lib/lock";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { settleInterest } from "@/lib/interest";

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const amount = Number(body?.amount);

  if (action !== "deposit" && action !== "withdraw") {
    return NextResponse.json(
      { error: "Invalid action." },
      { status: 400 }
    );
  }

  if (!Number.isSafeInteger(amount) || amount < 1) {
    return NextResponse.json(
      { error: "Enter a valid whole-number amount." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const first = await tx.player.findUnique({
        where: { userId }
      });

      if (!first) {
        throw new Error("PLAYER_NOT_FOUND");
      }

      const now = new Date();
      await settleInterest(tx, first.id, now);
      const player = await tx.player.findUnique({ where: { id: first.id } });

      if (!player) {
        throw new Error("PLAYER_NOT_FOUND");
      }

      if (action === "deposit") {
        if (player.money < amount) {
          throw new Error("NOT_ENOUGH_CASH");
        }
        const updated = await tx.player.update({
          where: { id: player.id },
          data: {
            money: { decrement: amount },
            bank: { increment: amount },
            bankSince: now
          }
        });
        return { money: updated.money, bank: updated.bank };
      }

      // withdraw
      if (player.bank < amount) {
        throw new Error("NOT_ENOUGH_BANK");
      }
      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          money: { increment: amount },
          bank: { decrement: amount },
          bankSince: now
        }
      });
      return { money: updated.money, bank: updated.bank };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "NOT_ENOUGH_CASH") {
      return NextResponse.json(
        { error: "You do not have that much cash on hand." },
        { status: 400 }
      );
    }
    if (message === "NOT_ENOUGH_BANK") {
      return NextResponse.json(
        { error: "You do not have that much in the bank." },
        { status: 400 }
      );
    }
    if (message === "PLAYER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    console.error("Bank action failed:", error);
    return NextResponse.json(
      { error: "Bank transaction failed." },
      { status: 500 }
    );
  }
}
