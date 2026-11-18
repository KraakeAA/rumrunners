import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const SHIELD_MS = 7 * 24 * 60 * 60 * 1000;
const NAME = /^[a-zA-Z0-9_]{3,18}$/;

class Refuse extends Error {}

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? "");

    await prisma.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { userId } });
      if (!me) throw new Refuse("Player not found.");
      if (me.health > 0) throw new Refuse("You are still alive.");

      // Keep the name that just died, so it stays reserved and can be revived later.
      await tx.pastLife.upsert({
        where: { username: me.username },
        create: {
          userId,
          username: me.username,
          rank: me.rank,
          rankLevel: me.rankLevel,
          diedAt: me.diedAt ?? new Date(),
          killedBy: me.killedBy
        },
        update: {
          rank: me.rank,
          rankLevel: me.rankLevel,
          diedAt: me.diedAt ?? new Date(),
          killedBy: me.killedBy,
          revivedAt: null
        }
      });

      let newName = "";

      if (mode === "new") {
        const wanted = String(body.username ?? "").trim();
        if (!NAME.test(wanted)) {
          throw new Refuse("Use 3 to 18 letters, numbers or underscores.");
        }
        const taken = await tx.player.findFirst({
          where: { username: { equals: wanted, mode: "insensitive" } },
          select: { id: true }
        });
        const ghost = await tx.pastLife.findFirst({
          where: { username: { equals: wanted, mode: "insensitive" } },
          select: { id: true }
        });
        if (taken || ghost) throw new Refuse("That name is already taken.");
        newName = wanted;
      } else if (mode === "revive") {
        const life = await tx.pastLife.findUnique({ where: { id: String(body.id ?? "") } });
        if (!life || life.userId !== userId) throw new Refuse("That name isn't yours to revive.");
        newName = life.username;
        await tx.pastLife.update({ where: { id: life.id }, data: { revivedAt: new Date() } });
      } else {
        throw new Refuse("Choose a new name or revive an old one.");
      }

      // Wipe everything the old life owned.
      await tx.inventoryItem.deleteMany({ where: { playerId: me.id } });
      await tx.car.deleteMany({ where: { ownerId: me.id } });
      await tx.crimeLog.deleteMany({ where: { playerId: me.id } });
      await tx.casinoLog.deleteMany({ where: { playerId: me.id } });
      await tx.lotteryTicket.deleteMany({ where: { playerId: me.id } });
      await tx.blackjackHand.deleteMany({ where: { playerId: me.id } });
      await tx.organisedCrime.deleteMany({ where: { leaderId: me.id } });
      await tx.ocSlot.updateMany({
        where: { playerId: me.id },
        data: { playerId: null, state: "empty", percent: null, choice: null, carId: null }
      });
      await tx.casino.updateMany({ where: { ownerId: me.id }, data: { ownerId: null, ownedSince: null } });
      await tx.bulletFactory.updateMany({ where: { ownerId: me.id }, data: { ownerId: null } });

      // Back to the start. Gold is the only thing that survives.
      await tx.player.update({
        where: { id: me.id },
        data: {
          username: newName,
          rank: "Scum",
          rankLevel: 1,
          money: 500,
          bank: 0,
          bullets: 0,
          health: 100,
          protection: 0,
          equipped: Prisma.DbNull,
          energy: 400,
          maxEnergy: 400,
          experience: 0,
          lastEnergyAt: new Date(),
          lastCrimeAt: null,
          lastTheftAt: null,
          theftTimes: Prisma.DbNull,
          jailUntil: null,
          jailReason: null,
          jailSecurity: 1,
          selfBustUsed: false,
          garageSlots: 5,
          cargo: Prisma.DbNull,
          theftWins: 0,
          theftFails: 0,
          boozeBought: 0,
          boozeSold: 0,
          boozeSpent: 0,
          boozeEarned: 0,
          ocsDone: 0,
          ocsLed: 0,
          ocEarned: 0,
          currentCity: "London",
          travelDestination: null,
          travelStartedAt: null,
          travelArrivesAt: null,
          profilePictureUrl: null,
          profileQuote: null,
          profileStatus: null,
          statusExpiresAt: null,
          profileViews: 0,
          shieldUntil: new Date(Date.now() + SHIELD_MS),
          diedAt: null,
          killedBy: null
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Refuse) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Rebirth failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
