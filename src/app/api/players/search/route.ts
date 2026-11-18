import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const LIMIT = 10;
const ONLINE_MS = 5 * 60 * 1000;

export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
    const status = url.searchParams.get("status") ?? "any";

    const rows = await prisma.player.findMany({
      where: {
        ...(q ? { username: { contains: q, mode: "insensitive" as const } } : {}),
        ...(status === "alive" ? { health: { gt: 0 } } : {}),
        ...(status === "dead" ? { health: { lte: 0 } } : {})
      },
      select: { username: true, rank: true, health: true, updatedAt: true },
      orderBy: { username: "asc" },
      take: LIMIT + 1
    });

    const now = Date.now();

    return NextResponse.json({
      more: rows.length > LIMIT,
      players: rows.slice(0, LIMIT).map((p) => ({
        username: p.username,
        rank: p.rank,
        alive: p.health > 0,
        online: now - p.updatedAt.getTime() < ONLINE_MS
      }))
    });
  } catch (error) {
    console.error("Player search failed:", error);
    return NextResponse.json({ error: "The search hit a server error." }, { status: 500 });
  }
}
