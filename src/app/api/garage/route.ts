import { denyIfDead } from "@/lib/alive";
import { lockPlayer } from "@/lib/lock";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { expireEscrowsFor } from "@/lib/escrow";
import { isAdminUser } from "@/lib/admin-bypass";
import { sendToJail, sentenceFor } from "@/lib/jail";
import { policeSweep } from "@/lib/police";
import {
  EXPOSURE_MINUTES,
  HEAT_RULES_FROM,
  heatZone,
  makeFalsePlate,
  plateCity,
  PLATE_COST,
  PLATE_HEAT_DROP,
  carModel,
  currentHeat,
  effectiveMinutes,
  makePlate,
  repairCost,
  scrapFor,
  SHIP_CITIES,
  shipCost,
} from "@/lib/era";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  try {
    const player = await prisma.player.findUnique({
      where: { userId },
      select: { id: true, money: true, currentCity: true, garageSlots: true },
    });
    if (!player) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    await expireEscrowsFor(prisma, player.id);

    const { rows, notices } = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const found = await policeSweep(tx, userId);
      const list = await tx.car.findMany({
        where: { ownerId: player.id, escrowId: null },
        orderBy: { createdAt: "asc" },
      });
      // Give any car that has no plate yet one from the city it was stolen in.
      for (const c of list) {
        if (!c.plate) {
          c.plate = makePlate(c.originCity);
          await tx.car.update({ where: { id: c.id }, data: { plate: c.plate } });
        }
      }
      return { rows: list, notices: found };
    });

    const fresh = await prisma.player.findUnique({
      where: { userId },
      select: { money: true },
    });
    player.money = fresh?.money ?? player.money;

    const now = Date.now();
    const cars = rows.flatMap((c) => {
      const m = carModel(c.model);
      if (!m) return [];
      const heat = currentHeat(c.heat, c.heatAt, now);
      const shipped = c.city !== c.originCity;
      const exposed =
        !c.plateChanged && !shipped && c.createdAt.getTime() >= HEAT_RULES_FROM;
      return [
        {
          id: c.id,
          ...m,
          scrap: scrapFor(m, c.damage),
          originCity: c.originCity,
          city: c.city,
          plate: c.plate,
          plateOrigin: plateCity(c.plate) ?? c.originCity,
          plateChanged: c.plateChanged,
          exposedUntil: exposed
            ? new Date(c.createdAt.getTime() + EXPOSURE_MINUTES * 60_000).toISOString()
            : null,
          damage: c.damage,
          baseMinutes: m.minutes,
          minutes: effectiveMinutes(m, c.damage),
          repairCost: repairCost(c.damage, m.tier),
          shipCost: shipCost(m.price),
          heat,
          zone: heatZone(heat),
        },
      ];
    });

    return NextResponse.json({
      money: player.money,
      currentCity: player.currentCity,
      cars,
      maxCars: player.garageSlots,
      plateCost: PLATE_COST,
      notices,
    });
  } catch (error) {
    console.error("Garage load failed:", error);
    return NextResponse.json(
      { error: "The garage is unavailable right now." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "");
  const carId = String(body?.carId ?? "");

  const destination = String(body?.destination ?? "");

  if ((action !== "plate" && action !== "repair" && action !== "ship") || !carId) {
    return NextResponse.json({ error: "Choose a car and a job." }, { status: 400 });
  }

  try {
    // Police checks are settled first, in their own step, so a failed job can't undo them.
    const notices = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
      return policeSweep(tx, userId);
    });

    const result = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) throw new Error("PLAYER_NOT_FOUND");

      const car = await tx.car.findFirst({ where: { id: carId, ownerId: player.id, escrowId: null } });
      const model = car ? carModel(car.model) : undefined;
      if (!car || !model) {
        // The police may just have taken it.
        if (notices.length > 0) return { message: notices.join(" "), caught: true };
        throw new Error("NO_CAR");
      }
      const now = new Date();

      if (action === "plate") {
        const paid = await tx.player.updateMany({
          where: { id: player.id, money: { gte: PLATE_COST } },
          data: { money: { decrement: PLATE_COST } },
        });
        if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");

        const heat = Math.max(
          0,
          currentHeat(car.heat, car.heatAt, now.getTime()) - PLATE_HEAT_DROP
        );
        // A false plate never shows the city the car was stolen in.
        const plate = makeFalsePlate(car.originCity, car.plate);
        await tx.car.update({
          where: { id: car.id },
          data: { plate, heat, heatAt: now, plateChanged: true },
        });
        return { plate, message: `Your ${model.name} now carries the plate ${plate}.` };
      }

      if (action === "ship") {
        if (!SHIP_CITIES.includes(destination)) throw new Error("BAD_CITY");
        if (destination === car.city) throw new Error("ALREADY_THERE");
        if (!car.plateChanged) {
          // Still on its stolen plates: the railway police check it at the station.
          await tx.car.delete({ where: { id: car.id } });
          if (!(await isAdminUser(userId, tx))) {
            const sentence = sentenceFor(model.tier + 1, player.rankLevel);
            await sendToJail(
              tx,
              player.id,
              sentence.seconds,
              sentence.security,
              `Caught shipping a stolen ${model.name}`,
              now
            );
          }
          return {
            caught: true,
            message: `Railway police checked your ${model.name} [${car.plate}] at the station and found it was stolen. The car was impounded and you were arrested. Change the plate first next time.`,
          };
        }
        const fee = shipCost(model.price);
        const paid = await tx.player.updateMany({
          where: { id: player.id, money: { gte: fee } },
          data: { money: { decrement: fee } },
        });
        if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
        await tx.car.update({ where: { id: car.id }, data: { city: destination } });
        return {
          message: `Your ${model.name} [${car.plate}] has been shipped to ${destination} for £${fee.toLocaleString("en-GB")}.`,
        };
      }

      if (car.damage <= 0) throw new Error("NOT_DAMAGED");
      const cost = repairCost(car.damage, model.tier);
      const paid = await tx.player.updateMany({
        where: { id: player.id, money: { gte: cost } },
        data: { money: { decrement: cost } },
      });
      if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");

      await tx.car.update({ where: { id: car.id }, data: { damage: 0 } });
      return { message: `Your ${model.name} is as good as new. Repairs cost £${cost.toLocaleString("en-GB")}.` };
    });

    const player = await prisma.player.findUnique({
      where: { userId },
      select: { money: true },
    });

    return NextResponse.json({ ok: true, money: player?.money ?? 0, ...result, notices });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      NO_CAR: ["You do not own that car.", 400],
      INSUFFICIENT_FUNDS: ["You do not have enough cash.", 400],
      NOT_DAMAGED: ["That car is not damaged.", 400],
      BAD_CITY: ["Choose a city to ship it to.", 400],
      ALREADY_THERE: ["That car is already in that city.", 400],
      PLAYER_NOT_FOUND: ["Player not found.", 404],
    };
    if (map[m]) {
      return NextResponse.json({ error: map[m][0] }, { status: map[m][1] });
    }
    console.error("Garage job failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
