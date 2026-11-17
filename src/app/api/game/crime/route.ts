import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import {
  CRIME_COOLDOWN_SECONDS,
  CRIMES,
  energyAfterRegen,
  levelFromXp,
  rollCrime
} from "@/lib/game";
import { rankForLevel } from "@/lib/ranks";

export async function POST(req: Request) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const crimeId = typeof body.crimeId === "string" ? body.crimeId : "street_robbery";
  const crime = CRIMES.find((c) => c.id === crimeId);

  if (!crime) {
    return NextResponse.json(
      { error: "Unknown job." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({
        where: { userId }
      });

      if (!player) {
        throw new Error("PLAYER_NOT_FOUND");
      }

      const now = new Date();

      if (
        player.lastCrimeAt &&
        now.getTime() - player.lastCrimeAt.getTime() <
          CRIME_COOLDOWN_SECONDS * 1000
      ) {
        const remaining = Math.ceil(
          (CRIME_COOLDOWN_SECONDS * 1000 -
            (now.getTime() - player.lastCrimeAt.getTime())) /
            1000
        );
        throw new Error(`COOLDOWN:${remaining}`);
      }

      const regen = energyAfterRegen(
        player.energy,
        player.maxEnergy,
        player.lastEnergyAt,
        now
      );

      if (regen.energy < crime.energyCost) {
        throw new Error("NO_ENERGY");
      }

      if (player.rankLevel < crime.minRankLevel) {
        throw new Error("RANK_TOO_LOW");
      }

      const roll = rollCrime(crime, player.rankLevel);
      const newXp = player.experience + roll.xp;
      const newLevel = levelFromXp(newXp);
      const newRank = rankForLevel(newLevel);

      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          energy: regen.energy - crime.energyCost,
          lastEnergyAt: regen.lastEnergyAt,
          money: { increment: roll.cash },
          experience: newXp,
          rankLevel: newLevel,
          rank: newRank,
          lastCrimeAt: now
        }
      });

      await tx.crimeLog.create({
        data: {
          playerId: player.id,
          crimeType: crime.name,
          success: roll.success,
          cashChange: roll.cash
        }
      });

      return {
        success: roll.success,
        cashChange: roll.cash,
        energy: updated.energy,
        money: updated.money,
        experience: updated.experience,
        rank: updated.rank,
        rankLevel: updated.rankLevel,
        crimeName: crime.name,
        xpGained: roll.xp,
        leveledUp: newLevel > player.rankLevel
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message.startsWith("COOLDOWN:")) {
      const remaining = message.split(":")[1];
      return NextResponse.json(
        { error: "COOLDOWN", remaining: Number(remaining) },
        { status: 429 }
      );
    }

    if (message === "NO_ENERGY") {
      return NextResponse.json(
        { error: "NO_ENERGY" },
        { status: 400 }
      );
    }

    if (message === "RANK_TOO_LOW") {
      return NextResponse.json(
        { error: "RANK_TOO_LOW" },
        { status: 403 }
      );
    }

    if (message === "PLAYER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    console.error("Crime action failed:", error);

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
