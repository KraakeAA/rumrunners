import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CITIES } from "@/lib/venues";
import { ensureVenues, settleFactory } from "@/lib/venues-server";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const city = String(body?.city ?? "");
  const quantity = Number(body?.quantity);

  if (!CITIES.includes(city)) {
    return NextResponse.json({ error: "Unknown city." }, { status: 400 });
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Enter how many bullets you want." }, { status: 400 });
  }

  try {
    await ensureVenues();

    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) throw new Error("PLAYER_NOT_FOUND");
      if (player.currentCity !== city) throw new Error("NOT_IN_CITY");

      const factory = await settleFactory(tx, city);
      if (!factory) throw new Error("FACTORY_NOT_FOUND");
      if (factory.ownerId === player.id) throw new Error("OWN_FACTORY");
      if (factory.stock < quantity) throw new Error("NOT_ENOUGH_STOCK");

      const cost = quantity * factory.pricePerBullet;

      const taken = await tx.bulletFactory.updateMany({
        where: { id: factory.id, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (taken.count !== 1) throw new Error("NOT_ENOUGH_STOCK");

      const paid = await tx.player.updateMany({
        where: { id: player.id, money: { gte: cost } },
        data: { money: { decrement: cost } },
      });
      if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");

      if (factory.ownerId) {
        await tx.player.update({
          where: { id: factory.ownerId },
          data: { money: { increment: cost } },
        });
        await tx.bulletFactory.update({
          where: { id: factory.id },
          data: { revenue: { increment: cost } },
        });
      }

      const updated = await tx.player.update({
        where: { id: player.id },
        data: { bullets: { increment: quantity } },
      });

      return { money: updated.money, bullets: updated.bullets, cost, quantity };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      NOT_IN_CITY: ["You need to be in this city to buy its bullets.", 400],
      NOT_ENOUGH_STOCK: ["The factory does not have that many bullets in stock.", 400],
      INSUFFICIENT_FUNDS: ["You do not have enough cash.", 400],
      OWN_FACTORY: ["You own this factory. Your bullets are made for sale to others.", 400],
      PLAYER_NOT_FOUND: ["Player not found.", 404],
      FACTORY_NOT_FOUND: ["Factory not found.", 404],
    };
    if (map[m]) {
      return NextResponse.json({ error: map[m][0] }, { status: map[m][1] });
    }
    console.error("Bullet purchase failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
