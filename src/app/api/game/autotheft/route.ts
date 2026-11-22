import { energyCostFor, levelOf } from "@/lib/training";
import { isAdminUser } from "@/lib/admin-bypass";
import { lockPlayer } from "@/lib/lock";
import { denyIfDead } from "@/lib/alive";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { energyAfterRegen, levelFromXp, maxEnergyFor } from "@/lib/game";
import { rankForLevel } from "@/lib/ranks";
import { jailRemaining, sendToJail, sentenceFor } from "@/lib/jail";
import { notifyPromotion } from "@/lib/promotion";
import {
  CARS,
  MAX_DAMAGE,
  makePlate,
  THEFT_COOLDOWNS,
  THEFT_LEVELS,
  theftChance,
} from "@/lib/era";

const STREETS: Record<string, string[]> = {
  London: ["a mews in Mayfair", "a side street off the Commercial Road", "outside a Soho club"],
  Birmingham: ["a back street in Digbeth", "outside a Bull Ring pub", "a lane in Small Heath"],
  Manchester: ["a street behind Piccadilly", "the Salford docks", "outside a Deansgate warehouse"],
  Liverpool: ["the Pier Head", "a lane off Scotland Road", "outside a Bold Street shop"],
  Glasgow: ["a close in the Gorbals", "outside a Sauchiehall Street hotel", "the Broomielaw quays"],
};

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const level = THEFT_LEVELS.find((l) => l.level === Number(body?.level));
  if (!level) {
    return NextResponse.json({ error: "Choose a type of job." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) throw new Error("PLAYER_NOT_FOUND");

      const admin = await isAdminUser(userId, tx);
      if (!admin && player.rankLevel < level.minRank) throw new Error("RANK_TOO_LOW");

      const now = new Date();

      if (!admin && jailRemaining(player.jailUntil, now) > 0) throw new Error("JAILED");

      const times =
        player.theftTimes && typeof player.theftTimes === "object"
          ? (player.theftTimes as Record<string, string>)
          : {};
      const cooldownMs = (THEFT_COOLDOWNS[level.level] ?? 60) * 1000;
      const lastTry = times[String(level.level)]
        ? new Date(times[String(level.level)])
        : null;

      if (!admin && lastTry && now.getTime() - lastTry.getTime() < cooldownMs) {
        const remaining = Math.ceil(
          (cooldownMs - (now.getTime() - lastTry.getTime())) / 1000
        );
        throw new Error(`COOLDOWN:${remaining}`);
      }

      const maxEnergy = maxEnergyFor(player.rankLevel);
      const regen = energyAfterRegen(player.energy, maxEnergy, player.lastEnergyAt, now);
      const energyCost = energyCostFor(level.energy, levelOf(player.staminaPts));
      if (!admin && regen.energy < energyCost) throw new Error("NO_ENERGY");

      const owned = await tx.car.count({ where: { ownerId: player.id } });
      if (owned >= player.garageSlots) throw new Error(`GARAGE_FULL:${player.garageSlots}`);

      // Which car turns up: every model is possible, weighted by level.
      const weighted = CARS.map((c) => ({ c, w: level.weights[c.tier - 1] }));
      const total = weighted.reduce((n, x) => n + x.w, 0);
      let roll = Math.random() * total;
      let model = weighted[0].c;
      for (const x of weighted) {
        roll -= x.w;
        if (roll <= 0) {
          model = x.c;
          break;
        }
      }

      const chance = theftChance(level, model.tier);
      const success = Math.random() < chance;
      const place = pick(STREETS[player.currentCity] ?? STREETS.London);

      const xp = success ? level.xp + (model.tier - 1) * 4 : 3;
      const fine = success ? 0 : Math.min(level.fine, player.money);
      const newXp = player.experience + xp;
      const newLevel = Math.max(player.rankLevel, levelFromXp(newXp));

      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          energy: Math.max(0, regen.energy - energyCost),
          maxEnergy: maxEnergyFor(newLevel),
          // A full tank has no running clock, so start one when energy is spent.
          lastEnergyAt:
            regen.energy >= maxEnergy ? now : regen.lastEnergyAt,
          money: { decrement: fine },
          experience: newXp,
          rankLevel: newLevel,
          rank: rankForLevel(newLevel),
          lastTheftAt: now,
          ...(success ? { theftWins: { increment: 1 } } : { theftFails: { increment: 1 } }),
          theftTimes: { ...times, [String(level.level)]: now.toISOString() },
        },
      });

      await notifyPromotion(tx, player.id, player.rankLevel, newLevel);

      let jailSeconds = 0;
      if (!admin && !success && Math.random() < 0.4) {
        const sentence = sentenceFor(level.level + 1, player.rankLevel);
        jailSeconds = sentence.seconds;
        await sendToJail(
          tx,
          player.id,
          jailSeconds,
          sentence.security,
          `Caught stealing a car (${level.name})`,
          now
        );
      }

      let carId: string | null = null;
      let heat = 0;
      let plate = "";
      let damage = 0;
      if (success) {
        heat = level.heat[model.tier - 1];
        plate = makePlate(player.currentCity);
        damage = Math.floor(Math.random() * (MAX_DAMAGE + 1));
        const car = await tx.car.create({
          data: {
            ownerId: player.id,
            model: model.key,
            originCity: player.currentCity,
            city: player.currentCity,
            heat,
            plate,
            damage,
            heatAt: now,
          },
        });
        carId = car.id;
      }

      return {
        success,
        carId,
        car: model,
        place,
        city: player.currentCity,
        chance: Math.round(chance * 100),
        heat,
        plate,
        damage,
        fine,
        xpGained: xp,
        energy: updated.energy,
        maxEnergy: updated.maxEnergy,
        money: updated.money,
        experience: updated.experience,
        rank: updated.rank,
        rankLevel: updated.rankLevel,
        leveledUp: newLevel > player.rankLevel,
        jailSeconds,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    if (m.startsWith("COOLDOWN:")) {
      return NextResponse.json({ error: "COOLDOWN", remaining: Number(m.split(":")[1]) }, { status: 429 });
    }
    if (m.startsWith("GARAGE_FULL:")) {
      return NextResponse.json(
        { error: `Your garage only holds ${m.split(":")[1]} cars. Melt one down, or buy a bigger garage in the Store.` },
        { status: 400 }
      );
    }
    const map: Record<string, [string, number]> = {
      JAILED: ["You're locked up. Wait out your sentence or try to break out.", 403],
      NO_ENERGY: ["You're exhausted. Wait for your energy to recover.", 400],
      RANK_TOO_LOW: ["You need a higher rank for that job.", 403],
      PLAYER_NOT_FOUND: ["Player not found.", 404],
    };
    if (map[m]) {
      return NextResponse.json({ error: map[m][0] }, { status: map[m][1] });
    }
    console.error("Auto theft failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
