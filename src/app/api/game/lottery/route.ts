import { denyIfDead } from "@/lib/alive";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jailRemaining } from "@/lib/jail";
import {
  HOUSE_CUT,
  MAX_TICKETS_PER_PLAYER,
  TICKET_PRICE,
  nextDrawAt,
  settleLotteries
} from "@/lib/lottery";

async function snapshot(playerId: string, money: number) {
  const drawAt = nextDrawAt();
  const [total, mine, last] = await Promise.all([
    prisma.lotteryTicket.count({ where: { drawAt } }),
    prisma.lotteryTicket.count({ where: { drawAt, playerId } }),
    prisma.lotteryDraw.findFirst({ orderBy: { drawAt: "desc" } })
  ]);

  return {
    money,
    drawAt: drawAt.toISOString(),
    ticketPrice: TICKET_PRICE,
    maxTickets: MAX_TICKETS_PER_PLAYER,
    houseCut: HOUSE_CUT,
    tickets: total,
    mine,
    pot: total * TICKET_PRICE,
    prize: Math.floor(total * TICKET_PRICE * (1 - HOUSE_CUT)),
    last: last
      ? { drawAt: last.drawAt.toISOString(), prize: last.prize, winner: last.winnerName, tickets: last.tickets }
      : null
  };
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  await settleLotteries();
  const me = await prisma.player.findUnique({ where: { userId } });
  if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  return NextResponse.json(await snapshot(me.id, me.money));
}

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const qty = Math.floor(Number(body.qty));
  if (!Number.isFinite(qty) || qty < 1 || qty > MAX_TICKETS_PER_PLAYER) {
    return NextResponse.json(
      { error: `Buy between 1 and ${MAX_TICKETS_PER_PLAYER} tickets.` },
      { status: 400 }
    );
  }

  await settleLotteries();

  try {
    const money = await prisma.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { userId } });
      if (!me) throw new Error("PLAYER_NOT_FOUND");
      if (jailRemaining(me.jailUntil, new Date()) > 0) throw new Error("JAILED");

      const drawAt = nextDrawAt();
      const held = await tx.lotteryTicket.count({ where: { drawAt, playerId: me.id } });
      if (held + qty > MAX_TICKETS_PER_PLAYER) throw new Error("TOO_MANY");

      const cost = qty * TICKET_PRICE;
      const paid = await tx.player.updateMany({
        where: { id: me.id, money: { gte: cost } },
        data: { money: { decrement: cost } }
      });
      if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");

      await tx.lotteryTicket.createMany({
        data: Array.from({ length: qty }, () => ({ playerId: me.id, drawAt }))
      });

      return me.money - cost;
    });

    const me = await prisma.player.findUnique({ where: { userId } });
    return NextResponse.json({
      ok: true,
      message: `You bought ${qty} ticket${qty === 1 ? "" : "s"}.`,
      ...(await snapshot(me!.id, money))
    });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      PLAYER_NOT_FOUND: ["Player not found.", 404],
      JAILED: ["No lottery tickets from a prison cell.", 403],
      TOO_MANY: [`You can hold at most ${MAX_TICKETS_PER_PLAYER} tickets for one draw.`, 400],
      INSUFFICIENT_FUNDS: ["You do not have enough cash.", 400]
    };
    if (map[m]) return NextResponse.json({ error: map[m][0] }, { status: map[m][1] });
    console.error("Lottery failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
