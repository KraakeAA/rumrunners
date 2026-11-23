import { denyIfDead } from "@/lib/alive";
import { lockPlayer } from "@/lib/lock";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { carModel, scrapFor } from "@/lib/era";

// Melt a car down at the bullet factory for bullets.
export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const carId = String(body?.carId ?? "");
  if (!carId) {
    return NextResponse.json({ error: "Choose a car to melt down." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) throw new Error("PLAYER_NOT_FOUND");

      // The factory in the city you are standing in must have an owner, and it can't be you.
      const factory = await tx.bulletFactory.findUnique({ where: { city: player.currentCity } });
      if (!factory || !factory.ownerId) throw new Error("NO_OWNER");
      if (factory.ownerId === player.id) throw new Error("OWN_FACTORY");

      const car = await tx.car.findFirst({ where: { id: carId, ownerId: player.id, escrowId: null } });
      const model = car ? carModel(car.model) : undefined;
      if (!car || !model) throw new Error("NO_CAR");

      // Deleting first means two quick taps cannot melt the same car twice.
      const gone = await tx.car.deleteMany({ where: { id: car.id, ownerId: player.id } });
      if (gone.count !== 1) throw new Error("NO_CAR");

      // Damaged cars are worth less as scrap.
      const gained = scrapFor(model, car.damage);
      const updated = await tx.player.update({
        where: { id: player.id },
        data: { bullets: { increment: gained } },
      });
      return { bullets: updated.bullets, gained, name: model.name };
    });

    return NextResponse.json({
      ok: true,
      bullets: result.bullets,
      message: `The ${result.name} was melted down into ${result.gained.toLocaleString("en-GB")} bullets.`,
    });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    if (m === "NO_OWNER") {
      return NextResponse.json({ error: "Nobody owns this factory, so it can't take your car." }, { status: 400 });
    }
    if (m === "OWN_FACTORY") {
      return NextResponse.json({ error: "You can't melt cars at your own factory." }, { status: 400 });
    }
    if (m === "NO_CAR") {
      return NextResponse.json({ error: "You do not own that car." }, { status: 400 });
    }
    console.error("Scrap failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
