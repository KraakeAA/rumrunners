import { denyIfDead } from "@/lib/alive";
import { lockPlayer } from "@/lib/lock";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  ABSOLUTE_MAX_BET,
  CASINO_GAMES,
  CITIES,
  HOUSE_MAX_BET,
  casinoDef,
  isHouseOnly,
  OPENING_WINDOW_MS,
} from "@/lib/venues";
import { ensureVenues } from "@/lib/venues-server";

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "");
  const city = String(body?.city ?? "");
  const game = String(body?.game ?? "");

  if (!CITIES.includes(city) || !CASINO_GAMES.some((g) => g.key === game)) {
    return NextResponse.json({ error: "Unknown casino." }, { status: 400 });
  }

  try {
    await ensureVenues();

    const result = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) throw new Error("PLAYER_NOT_FOUND");

      const casino = await tx.casino.findUnique({
        where: { city_game: { city, game } },
      });
      if (!casino) throw new Error("CASINO_NOT_FOUND");

      if (isHouseOnly(game)) throw new Error("HOUSE_ONLY");

      if (action === "buy") {
        if (casino.ownerId) throw new Error("ALREADY_OWNED");
        if (player.currentCity !== city) throw new Error("NOT_IN_CITY");

        const price = casinoDef(game).price;
        const paid = await tx.player.updateMany({
          where: { id: player.id, money: { gte: price } },
          data: { money: { decrement: price } },
        });
        if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");

        // Claim only if still unowned, so two buyers cannot both win.
        const claimed = await tx.casino.updateMany({
          where: { id: casino.id, ownerId: null },
          data: {
            ownerId: player.id,
            ownedSince: new Date(),
            chips: 0,
            openAt: new Date(Date.now() + OPENING_WINDOW_MS),
            profit: 0,
            plays: 0,
            wagered: 0,
          },
        });
        if (claimed.count !== 1) throw new Error("ALREADY_OWNED");
        return { message: `You now own the ${city} ${casinoDef(game).label} casino. Deposit chips within 5 minutes: nobody can play until it opens.` };
      }

      if (action === "setMaxBet") {
        if (casino.ownerId !== player.id) throw new Error("NOT_OWNER");
        if (casino.escrowId) throw new Error("IN_ESCROW");
        const maxBet = Number(body?.maxBet);
        if (!Number.isSafeInteger(maxBet) || maxBet < 1 || maxBet > ABSOLUTE_MAX_BET) {
          throw new Error("BAD_MAX_BET");
        }
        await tx.casino.update({ where: { id: casino.id }, data: { maxBet } });
        return { message: `Maximum bet set to £${maxBet.toLocaleString("en-GB")}.` };
      }

      if (action === "deposit" || action === "withdraw") {
        if (casino.ownerId !== player.id) throw new Error("NOT_OWNER");
        if (casino.escrowId) throw new Error("IN_ESCROW");
        const amount = Number(body?.amount);
        if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("BAD_AMOUNT");

        if (action === "deposit") {
          const paid = await tx.player.updateMany({
            where: { id: player.id, money: { gte: amount } },
            data: { money: { decrement: amount } },
          });
          if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
          await tx.casino.update({ where: { id: casino.id }, data: { chips: { increment: amount } } });
          return { message: `You deposited £${amount.toLocaleString("en-GB")} in chips.` };
        }

        const taken = await tx.casino.updateMany({
          where: { id: casino.id, ownerId: player.id, chips: { gte: amount } },
          data: { chips: { decrement: amount } },
        });
        if (taken.count !== 1) throw new Error("NOT_ENOUGH_CHIPS");
        await tx.player.update({ where: { id: player.id }, data: { money: { increment: amount } } });
        return { message: `You withdrew £${amount.toLocaleString("en-GB")} in chips back to your cash.` };
      }

      if (action === "drop") {
        if (casino.ownerId !== player.id) throw new Error("NOT_OWNER");
        if (casino.escrowId) throw new Error("IN_ESCROW");
        const released = await tx.casino.updateMany({
          where: { id: casino.id, ownerId: player.id },
          data: { ownerId: null, ownedSince: null, openAt: null, chips: 0, maxBet: HOUSE_MAX_BET, profit: 0, plays: 0, wagered: 0 }
        });
        // The chips go back to the owner as cash.
        if (released.count === 1 && casino.chips > 0) {
          await tx.player.update({ where: { id: player.id }, data: { money: { increment: casino.chips } } });
        }
        return { message: `You have dropped the ${city} ${casinoDef(game).label} casino. It is back on the market.` };
      }

      throw new Error("BAD_ACTION");
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      ALREADY_OWNED: ["Someone already owns this casino.", 400],
      HOUSE_ONLY: ["That table is always run by the house.", 400],
      NOT_IN_CITY: ["You need to be in this city to buy its casino.", 400],
      INSUFFICIENT_FUNDS: ["You do not have enough cash.", 400],
      NOT_OWNER: ["You do not own this casino.", 403],
      IN_ESCROW: ["This casino is in an escrow trade and can't be changed.", 400],
      BAD_MAX_BET: [
        `Enter a maximum bet between £1 and £${ABSOLUTE_MAX_BET.toLocaleString("en-GB")}.`,
        400,
      ],
      BAD_AMOUNT: ["Enter a whole number of chips, at least 1.", 400],
      NOT_ENOUGH_CHIPS: ["The casino doesn't hold that many chips.", 400],
      BAD_ACTION: ["Unknown action.", 400],
      PLAYER_NOT_FOUND: ["Player not found.", 404],
      CASINO_NOT_FOUND: ["Casino not found.", 404],
    };
    if (map[m]) {
      return NextResponse.json({ error: map[m][0] }, { status: map[m][1] });
    }
    console.error("Casino action failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
