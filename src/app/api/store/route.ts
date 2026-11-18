import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jailRemaining } from "@/lib/jail";
import {
  CATALOGUE,
  GARAGE_CAP,
  PROTECTION_CAP,
  findItem,
  itemKey
} from "@/lib/store";

async function view(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  const owned = await prisma.inventoryItem.findMany({ where: { playerId } });
  const have = new Set(owned.filter((o) => o.quantity > 0).map((o) => o.itemType));

  return {
    money: player?.money ?? 0,
    garageSlots: player?.garageSlots ?? 5,
    protection: player?.protection ?? 0,
    protectionCap: PROTECTION_CAP,
    garageCap: GARAGE_CAP,
    items: CATALOGUE.map((i) => ({ ...i, owned: have.has(itemKey(i)) }))
  };
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const me = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
  if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  return NextResponse.json(await view(me.id));
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const item = findItem(String(body.kind ?? ""), String(body.key ?? ""));
  if (!item) return NextResponse.json({ error: "That isn't for sale." }, { status: 400 });

  try {
    const playerId = await prisma.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { userId } });
      if (!me) throw new Error("PLAYER_NOT_FOUND");
      if (jailRemaining(me.jailUntil, new Date()) > 0) throw new Error("JAILED");

      const type = itemKey(item);
      const already = await tx.inventoryItem.findUnique({
        where: { playerId_itemType: { playerId: me.id, itemType: type } }
      });
      if (already && already.quantity > 0) throw new Error("OWNED");

      if (item.kind === "garage" && me.garageSlots >= GARAGE_CAP) throw new Error("GARAGE_MAX");
      if (item.kind === "protection" && me.protection >= PROTECTION_CAP) throw new Error("PROTECTION_MAX");

      const paid = await tx.player.updateMany({
        where: { id: me.id, money: { gte: item.price } },
        data: { money: { decrement: item.price } }
      });
      if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");

      await tx.inventoryItem.upsert({
        where: { playerId_itemType: { playerId: me.id, itemType: type } },
        create: { playerId: me.id, itemType: type, quantity: 1 },
        update: { quantity: 1 }
      });

      if (item.kind === "garage") {
        await tx.player.update({
          where: { id: me.id },
          data: { garageSlots: Math.min(GARAGE_CAP, me.garageSlots + item.value) }
        });
      } else if (item.kind === "protection") {
        await tx.player.update({
          where: { id: me.id },
          data: { protection: Math.min(PROTECTION_CAP, me.protection + item.value) }
        });
      }

      return me.id;
    });

    return NextResponse.json({ ok: true, message: `You bought the ${item.name}.`, ...(await view(playerId)) });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      PLAYER_NOT_FOUND: ["Player not found.", 404],
      JAILED: ["The shops are closed to men in prison.", 403],
      OWNED: ["You already have that.", 400],
      GARAGE_MAX: ["Your garage can't get any bigger.", 400],
      PROTECTION_MAX: ["You are as well protected as money can make you.", 400],
      INSUFFICIENT_FUNDS: ["You do not have enough cash.", 400]
    };
    if (map[m]) return NextResponse.json({ error: map[m][0] }, { status: map[m][1] });
    console.error("Store purchase failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
