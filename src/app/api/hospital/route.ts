import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { regenHealth } from "@/lib/whack";

// Each missing point of health costs this much to patch up.
const COST_PER_POINT = 5;

async function current(userId: string) {
  const me = await prisma.player.findUnique({ where: { userId } });
  if (!me) return null;
  const r = regenHealth(me.health, me.healthAt);
  if (r.health !== me.health) {
    return prisma.player.update({ where: { id: me.id }, data: { health: r.health, healthAt: r.healthAt } });
  }
  return me;
}

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const me = await current(userId);
    if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    return NextResponse.json({
      health: me.health,
      money: me.money,
      costPerPoint: COST_PER_POINT,
      cost: Math.max(0, 100 - me.health) * COST_PER_POINT
    });
  } catch (error) {
    console.error("Hospital load failed:", error);
    return NextResponse.json({ error: "The hospital could not be reached." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const me = await current(userId);
    if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    if (me.health <= 0) return NextResponse.json({ error: "It is too late for that." }, { status: 400 });
    if (me.health >= 100) return NextResponse.json({ error: "You are in perfect health." }, { status: 400 });

    const cost = (100 - me.health) * COST_PER_POINT;
    const paid = await prisma.player.updateMany({
      where: { id: me.id, money: { gte: cost }, health: me.health },
      data: { money: { decrement: cost }, health: 100, healthAt: null }
    });
    if (paid.count !== 1) {
      return NextResponse.json({ error: "You do not have enough cash." }, { status: 400 });
    }
    const after = await prisma.player.findUnique({ where: { id: me.id } });
    return NextResponse.json({
      ok: true,
      message: "The doctors patch you up.",
      health: 100,
      money: after?.money ?? 0,
      costPerPoint: COST_PER_POINT,
      cost: 0
    });
  } catch (error) {
    console.error("Hospital failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
