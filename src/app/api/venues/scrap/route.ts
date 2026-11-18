import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { carModel } from "@/lib/era";

// Melt a car down at the bullet factory for bullets.
export async function POST(req: Request) {
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
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) throw new Error("PLAYER_NOT_FOUND");

      const car = await tx.car.findFirst({ where: { id: carId, ownerId: player.id } });
      const model = car ? carModel(car.model) : undefined;
      if (!car || !model) throw new Error("NO_CAR");
      if (car.city !== player.currentCity) throw new Error("CAR_ELSEWHERE");

      // Deleting first means two quick taps cannot melt the same car twice.
      const gone = await tx.car.deleteMany({ where: { id: car.id, ownerId: player.id } });
      if (gone.count !== 1) throw new Error("NO_CAR");

      const updated = await tx.player.update({
        where: { id: player.id },
        data: { bullets: { increment: model.scrap } },
      });
      return { bullets: updated.bullets, gained: model.scrap, name: model.name };
    });

    return NextResponse.json({
      ok: true,
      bullets: result.bullets,
      message: `The ${result.name} was melted down into ${result.gained.toLocaleString("en-GB")} bullets.`,
    });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    if (m === "CAR_ELSEWHERE") {
      return NextResponse.json(
        { error: "That car is parked in another city. Drive it here first." },
        { status: 400 }
      );
    }
    if (m === "NO_CAR") {
      return NextResponse.json({ error: "You do not own that car." }, { status: 400 });
    }
    console.error("Scrap failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
