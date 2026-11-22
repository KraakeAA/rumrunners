import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { getGameStats } from "@/lib/gamestats";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const [stats, crews, rankGroups, busters, bustSums] = await Promise.all([
    getGameStats(),
    // Crews are listed live so a new one can be clicked straight away.
    prisma.crew.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, _count: { select: { members: true } } }
    }),
    prisma.player.groupBy({
      by: ["rank", "rankLevel"],
      where: { health: { gt: 0 } },
      _count: { _all: true },
      orderBy: { rankLevel: "desc" }
    }),
    prisma.player.findMany({
      where: { bustWins: { gt: 0 } },
      orderBy: { bustWins: "desc" },
      take: 10,
      select: { username: true, bustWins: true }
    }),
    prisma.player.aggregate({ _sum: { bustWins: true, bustFails: true } })
  ]);

  return NextResponse.json({
    ...stats,
    ranks: rankGroups.map((g) => ({ rank: g.rank, players: g._count._all })),
    topBusters: busters.map((b) => ({ username: b.username, busts: b.bustWins })),
    busts: { won: bustSums._sum.bustWins ?? 0, failed: bustSums._sum.bustFails ?? 0 },
    crews: crews.map((c) => ({ id: c.id, name: c.name, color: c.color, members: c._count.members }))
  });
}
