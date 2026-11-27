import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { CRIMES } from "@/lib/game";

// How many times the player has tried each crime, keyed by crime id.
// A player's chance at a crime grows with every attempt.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const player = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }
  const groups = await prisma.crimeLog.groupBy({
    by: ["crimeType"],
    where: { playerId: player.id },
    _count: { _all: true }
  });
  const byName = new Map(groups.map((g) => [g.crimeType, g._count._all]));
  const practice: Record<string, number> = {};
  for (const c of CRIMES) {
    const n = byName.get(c.name);
    if (n) practice[c.id] = n;
  }
  return NextResponse.json({ practice });
}
