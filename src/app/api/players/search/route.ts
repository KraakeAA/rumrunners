import { NOT_HIDDEN_STAFF } from "@/lib/staff";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const LIMIT = 10;
const ONLINE_MS = 5 * 60 * 1000;

type Hit = { username: string; rank: string; alive: boolean; online: boolean; ghost: boolean };

export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
    const status = url.searchParams.get("status") ?? "any";
    const nameFilter = q ? { username: { contains: q, mode: "insensitive" as const } } : {};

    const rows = await prisma.player.findMany({
      where: {
        ...nameFilter,
        user: NOT_HIDDEN_STAFF,
        ...(status === "alive" ? { health: { gt: 0 } } : {}),
        ...(status === "dead" ? { health: { lte: 0 } } : {})
      },
      select: { username: true, rank: true, health: true, updatedAt: true },
      orderBy: { username: "asc" },
      take: LIMIT + 1
    });

    const now = Date.now();
    const hits = new Map<string, Hit>();
    for (const p of rows) {
      hits.set(p.username.toLowerCase(), {
        username: p.username,
        rank: p.rank,
        alive: p.health > 0,
        online: now - p.updatedAt.getTime() < ONLINE_MS,
        ghost: false
      });
    }

    // Names that have died and have not been revived, for Any and Dead searches.
    if (status !== "alive") {
      const ghosts = await prisma.pastLife.findMany({
        where: { ...nameFilter, revivedAt: null },
        select: { username: true, rank: true },
        orderBy: { username: "asc" },
        take: LIMIT + 1
      });
      for (const g of ghosts) {
        const key = g.username.toLowerCase();
        if (!hits.has(key)) {
          hits.set(key, { username: g.username, rank: g.rank, alive: false, online: false, ghost: true });
        }
      }
    }

    const all = [...hits.values()].sort((a, b) =>
      a.username.toLowerCase().localeCompare(b.username.toLowerCase())
    );

    return NextResponse.json({
      more: all.length > LIMIT,
      players: all.slice(0, LIMIT)
    });
  } catch (error) {
    console.error("Player search failed:", error);
    return NextResponse.json({ error: "The search hit a server error." }, { status: 500 });
  }
}
