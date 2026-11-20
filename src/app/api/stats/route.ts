import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { getGameStats } from "@/lib/gamestats";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const [stats, crews] = await Promise.all([
    getGameStats(),
    // Crews are listed live so a new one can be clicked straight away.
    prisma.crew.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, _count: { select: { members: true } } }
    })
  ]);

  return NextResponse.json({
    ...stats,
    crews: crews.map((c) => ({ id: c.id, name: c.name, color: c.color, members: c._count.members }))
  });
}
