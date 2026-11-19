import { denyIfDead } from "@/lib/alive";
import { settleHunts } from "@/lib/whack";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import {
  CRIMES,
  ENERGY_REGEN_MS,
  ENERGY_UNIT,
  maxEnergyFor,
  crimeCooldownSeconds,
  energyAfterRegen,
  levelFromXp,
  playCrime,
  streakFromLogs
} from "@/lib/game";
import { rankForLevel } from "@/lib/ranks";
import { THEFT_COOLDOWNS } from "@/lib/era";
import { jailRemaining, sendToJail, sentenceFor } from "@/lib/jail";
import { notifyPromotion } from "@/lib/promotion";
import { settleLotteries } from "@/lib/lottery";

// Energy, and how long until each job can be tried again.
export async function GET() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const player = await prisma.player.findUnique({ where: { userId } });

  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  // Draw the Wednesday lottery once its time has passed (does nothing otherwise).
  await settleLotteries().catch(() => {});
  // Tell the player when a detective has found their man.
  await settleHunts(player.id).catch(() => {});

  const now = new Date();
  const maxEnergy = maxEnergyFor(player.rankLevel);
  const regen = energyAfterRegen(
    player.energy,
    maxEnergy,
    player.lastEnergyAt,
    now
  );
  const unreadMail = await prisma.message.count({
    where: { toId: player.id, readAt: null }
  });
  const nextEnergyIn =
    regen.energy >= maxEnergy
      ? 0
      : Math.max(
          1,
          Math.ceil(
            (ENERGY_REGEN_MS - (now.getTime() - regen.lastEnergyAt.getTime())) / 1000
          )
        );

  const last = await prisma.crimeLog.groupBy({
    by: ["crimeType"],
    where: { playerId: player.id },
    _max: { createdAt: true }
  });
  const lastByName = new Map(last.map((l) => [l.crimeType, l._max.createdAt]));

  const crimes: Record<string, number> = {};
  for (const c of CRIMES) {
    const at = lastByName.get(c.name);
    if (!at) continue;
    const left = Math.ceil(
      (crimeCooldownSeconds(c.energyCost) * 1000 - (now.getTime() - at.getTime())) / 1000
    );
    if (left > 0) crimes[c.id] = left;
  }

  const times =
    player.theftTimes && typeof player.theftTimes === "object"
      ? (player.theftTimes as Record<string, string>)
      : {};
  const thefts: Record<string, number> = {};
  for (const [level, secs] of Object.entries(THEFT_COOLDOWNS)) {
    const at = times[level] ? new Date(times[level]) : null;
    if (!at) continue;
    const left = Math.ceil((secs * 1000 - (now.getTime() - at.getTime())) / 1000);
    if (left > 0) thefts[level] = left;
  }

  return NextResponse.json({
    jail: jailRemaining(player.jailUntil, now),
    energy: regen.energy,
    maxEnergy,
    regenMs: ENERGY_REGEN_MS,
    unreadMail,
    nextEnergyIn,
    crimes,
    thefts
  });
}

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

      if (jailRemaining(player.jailUntil, now) > 0) {
        throw new Error("JAILED");
      }

      const lastTry = await tx.crimeLog.findFirst({
        where: { playerId: player.id, crimeType: crime.name },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      });
      const cooldownMs = crimeCooldownSeconds(crime.energyCost) * 1000;

      if (lastTry && now.getTime() - lastTry.createdAt.getTime() < cooldownMs) {
        const remaining = Math.ceil(
          (cooldownMs - (now.getTime() - lastTry.createdAt.getTime())) / 1000
        );
        throw new Error(`COOLDOWN:${remaining}`);
      }

      const maxEnergy = maxEnergyFor(player.rankLevel);
      const regen = energyAfterRegen(
        player.energy,
        maxEnergy,
        player.lastEnergyAt,
        now
      );

      if (regen.energy < crime.energyCost) {
        throw new Error("NO_ENERGY");
      }

      if (player.rankLevel < crime.minRankLevel) {
        throw new Error("RANK_TOO_LOW");
      }

      const recent = await tx.crimeLog.findMany({
        where: { playerId: player.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { success: true }
      });
      const streak = streakFromLogs(recent);

      const roll = playCrime(
        crime,
        player.rankLevel,
        streak,
        player.money
      );
      const newXp = player.experience + roll.xp;
      // Never demote: a player keeps the rank they already hold.
      const newLevel = Math.max(player.rankLevel, levelFromXp(newXp));
      const newRank = rankForLevel(newLevel);

      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          energy: regen.energy - crime.energyCost,
          maxEnergy: maxEnergyFor(newLevel),
          // A full tank has no running clock, so start one when energy is spent.
          lastEnergyAt:
            regen.energy >= maxEnergy ? now : regen.lastEnergyAt,
          money: { increment: roll.cash }, // negative when caught and fined
          experience: newXp,
          rankLevel: newLevel,
          rank: newRank,
          lastCrimeAt: now
        }
      });

      await notifyPromotion(tx, player.id, player.rankLevel, newLevel);

      let jailSeconds = 0;
      if (roll.tier === "caught") {
        const sentence = sentenceFor(crime.energyCost / ENERGY_UNIT, player.rankLevel);
        jailSeconds = sentence.seconds;
        await sendToJail(
          tx,
          player.id,
          sentence.seconds,
          sentence.security,
          `Caught during ${crime.name}`,
          now
        );
      }

      await tx.crimeLog.create({
        data: {
          playerId: player.id,
          crimeType: crime.name,
          success: roll.success,
          cashChange: roll.cash
        }
      });

      const newStreak = roll.success ? Math.min(5, streak + 1) : 0;

      return {
        success: roll.success,
        cashChange: roll.cash,
        energy: updated.energy,
        maxEnergy: updated.maxEnergy,
        money: updated.money,
        experience: updated.experience,
        rank: updated.rank,
        rankLevel: updated.rankLevel,
        crimeName: crime.name,
        xpGained: roll.xp,
        leveledUp: newLevel > player.rankLevel,
        tier: roll.tier,
        label: roll.label,
        sceneTitle: roll.sceneTitle,
        setup: roll.setup,
        result: roll.result,
        streak: newStreak,
        streakBonus: roll.streakBonus,
        cooldown: crimeCooldownSeconds(crime.energyCost),
        jailSeconds
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

    if (message === "JAILED") {
      return NextResponse.json({ error: "JAILED" }, { status: 403 });
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
