
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import {
  CRIME_COOLDOWN_SECONDS,
  CRIME_ENERGY_COST,
  energyAfterRegen,
  rollCrime
} from "@/lib/game";

export async function POST() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401 }
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
        throw new Error("COOLDOWN");
      }

      const regen = energyAfterRegen(
        player.energy,
        player.maxEnergy,
        player.lastEnergyAt,
        now
      );

      if (regen.energy < CRIME_ENERGY_COST) {
        throw new Error("NO_ENERGY");
      }

      const roll = rollCrime();

      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          energy: regen.energy - CRIME_ENERGY_COST,
          lastEnergyAt: regen.lastEnergyAt,
          money: { increment: roll.cash },
          experience: { increment: roll.success ? 5 : 1 },
          lastCrimeAt: now
        }
      });

      await tx.crimeLog.create({
        data: {
          playerId: player.id,
          crimeType: "Street robbery",
          success: roll.success,
          cashChange: roll.cash
        }
      });

      return {
        success: roll.success,
        cashChange: roll.cash,
        energy: updated.energy,
        money: updated.money
      };
    });

    return NextResponse.json(result);

  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "COOLDOWN") {
      return NextResponse.json(
        { error: "COOLDOWN" },
        { status: 429 }
      );
    }

    if (message === "NO_ENERGY") {
      return NextResponse.json(
        { error: "NO_ENERGY" },
        { status: 400 }
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
