import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { staffLevel } from "@/lib/staff";

// A tiny read so the top bar can keep cash, bank, gold and bullets current
// when other people's actions change them (a gambler at your casino, a sale).
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const me = await prisma.player.findUnique({
    where: { userId },
    select: { id: true, money: true, bank: true, gold: true, bullets: true, health: true, rank: true, rankLevel: true, experience: true, user: { select: { isAdmin: true, staffRole: true } } }
  });
  if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  // Mail rides along so the inbox badge and an open mailbox update at once.
  const [unreadMail, latest, jailCount] = await Promise.all([
    prisma.message.count({ where: { toId: me.id, readAt: null } }),
    prisma.message.findFirst({
      where: { toId: me.id },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    }),
    // Everyone currently locked up, so the jail icon can light up.
    prisma.player.count({ where: { jailUntil: { gt: new Date() } } })
  ]);

  const { id: _id, user, ...cash } = me;
  return NextResponse.json({ ...cash, staff: staffLevel(user), unreadMail, jailCount, latestMailId: latest?.id ?? "" }, { headers: { "Cache-Control": "no-store" } });
}
