import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

type Grave = {
  name: string;
  rank: string;
  diedAt: string;
  killedBy: string | null;
  revived: boolean;
};

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const [lives, dead] = await Promise.all([
      prisma.pastLife.findMany({ orderBy: { diedAt: "desc" }, take: 100 }),
      // Players who have just died and not yet seen their dead screen.
      prisma.player.findMany({
        where: { health: { lte: 0 } },
        select: { username: true, rank: true, diedAt: true, killedBy: true },
        take: 100
      })
    ]);

    const graves = new Map<string, Grave>();
    for (const l of lives) {
      graves.set(l.username.toLowerCase(), {
        name: l.username,
        rank: l.rank,
        diedAt: l.diedAt.toISOString(),
        killedBy: l.killedBy === "suicide" ? "suicide" : l.killedBy ? "shot" : null,
        revived: l.revivedAt !== null
      });
    }
    for (const p of dead) {
      const key = p.username.toLowerCase();
      if (!graves.has(key)) {
        graves.set(key, {
          name: p.username,
          rank: p.rank,
          diedAt: (p.diedAt ?? new Date()).toISOString(),
          killedBy: p.killedBy === "suicide" ? "suicide" : p.killedBy ? "shot" : null,
          revived: false
        });
      }
    }

    const list = [...graves.values()]
      .sort((a, b) => b.diedAt.localeCompare(a.diedAt))
      .slice(0, 100);

    return NextResponse.json({ graves: list });
  } catch (error) {
    console.error("Graveyard load failed:", error);
    return NextResponse.json({ error: "The graveyard could not be reached." }, { status: 500 });
  }
}
