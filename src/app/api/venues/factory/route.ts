import { denyIfDead } from "@/lib/alive";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CITIES, FACTORY } from "@/lib/venues";
import { ensureVenues, settleFactory } from "@/lib/venues-server";

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

  if (!CITIES.includes(city)) {
    return NextResponse.json({ error: "Unknown city." }, { status: 400 });
  }

  try {
    await ensureVenues();

    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) throw new Error("PLAYER_NOT_FOUND");

      // Bring production up to date before any change of owner or price.
      const factory = await settleFactory(tx, city);
      if (!factory) throw new Error("FACTORY_NOT_FOUND");

      if (action === "buy") {
        if (factory.ownerId) throw new Error("ALREADY_OWNED");
        if (player.currentCity !== city) throw new Error("NOT_IN_CITY");

        const paid = await tx.player.updateMany({
          where: { id: player.id, money: { gte: FACTORY.price } },
          data: { money: { decrement: FACTORY.price } },
        });
        if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");

        const claimed = await tx.bulletFactory.updateMany({
          where: { id: factory.id, ownerId: null },
          data: {
            ownerId: player.id,
            lastProducedAt: new Date(),
            totalProduced: 0,
            revenue: 0,
          },
        });
        if (claimed.count !== 1) throw new Error("ALREADY_OWNED");
        return { message: `You now own the ${city} bullet factory.` };
      }

      if (action === "setPrice") {
        if (factory.ownerId !== player.id) throw new Error("NOT_OWNER");
        const price = Number(body?.pricePerBullet);
        if (!Number.isSafeInteger(price) || price < 1 || price > FACTORY.maxPrice) {
          throw new Error("BAD_PRICE");
        }
        await tx.bulletFactory.update({
          where: { id: factory.id },
          data: { pricePerBullet: price },
        });
        return { message: `Bullet price set to £${price.toLocaleString("en-GB")}.` };
      }

      throw new Error("BAD_ACTION");
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      ALREADY_OWNED: ["Someone already owns this factory.", 400],
      NOT_IN_CITY: ["You need to be in this city to buy its factory.", 400],
      INSUFFICIENT_FUNDS: ["You do not have enough cash.", 400],
      NOT_OWNER: ["You do not own this factory.", 403],
      BAD_PRICE: [`Enter a price between £1 and £${FACTORY.maxPrice.toLocaleString("en-GB")}.`, 400],
      BAD_ACTION: ["Unknown action.", 400],
      PLAYER_NOT_FOUND: ["Player not found.", 404],
      FACTORY_NOT_FOUND: ["Factory not found.", 404],
    };
    if (map[m]) {
      return NextResponse.json({ error: map[m][0] }, { status: map[m][1] });
    }
    console.error("Factory action failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
