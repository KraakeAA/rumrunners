import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

// A tiny read so the top bar can keep cash, bank, gold and bullets current
// when other people's actions change them (a gambler at your casino, a sale).
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const me = await prisma.player.findUnique({
    where: { userId },
    select: { money: true, bank: true, gold: true, bullets: true }
  });
  if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  return NextResponse.json(me, { headers: { "Cache-Control": "no-store" } });
}
