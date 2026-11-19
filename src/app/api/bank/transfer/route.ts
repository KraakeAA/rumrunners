import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { denyIfDead } from "@/lib/alive";
import { splitTransfer, TRANSFER_FEE } from "@/lib/fees";
import { INTEREST_MS, INTEREST_RATE, interestOn, settleInterest } from "@/lib/interest";

class Refuse extends Error {}

const SHOWN = 10;
const ALL = 100;

async function history(meId: string, all: boolean) {
  const acct = await settleInterest(prisma, meId);
  const take = all ? ALL : SHOWN;
  const life = await prisma.player.findUnique({ where: { id: meId }, select: { bornAt: true } });
  const since = life?.bornAt ?? new Date(0);
  const [sent, received, sentTotal, receivedTotal] = await Promise.all([
    prisma.transfer.findMany({ where: { fromId: meId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take }),
    prisma.transfer.findMany({ where: { toId: meId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take }),
    prisma.transfer.aggregate({ where: { fromId: meId, createdAt: { gte: since } }, _sum: { amount: true } }),
    prisma.transfer.aggregate({ where: { toId: meId, createdAt: { gte: since } }, _sum: { received: true } })
  ]);
  const me = await prisma.player.findUnique({ where: { id: meId }, select: { money: true } });
  return {
    money: me?.money ?? 0,
    bank: acct.bank,
    interestPercent: Math.round(INTEREST_RATE * 100),
    nextInterestAt: acct.bankSince && acct.bank > 0 ? new Date(acct.bankSince.getTime() + INTEREST_MS).toISOString() : null,
    nextInterest: interestOn(acct.bank),
    feePercent: Math.round(TRANSFER_FEE * 100),
    sent: sent.map((t) => ({
      id: t.id,
      at: t.createdAt.toISOString(),
      who: t.kind === "player" ? t.toName : t.kind === "escrow" ? "Escrow trade" : "Marketplace transaction",
      player: t.kind === "player",
      amount: t.amount,
      reference: t.reference
    })),
    received: received.map((t) => ({
      id: t.id,
      at: t.createdAt.toISOString(),
      who: t.kind === "player" ? t.fromName : t.kind === "escrow" ? "Escrow trade" : "Marketplace transaction",
      player: t.kind === "player",
      amount: t.received,
      reference: t.reference
    })),
    totalSent: sentTotal._sum.amount ?? 0,
    totalReceived: receivedTotal._sum.received ?? 0
  };
}

export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const me = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
    if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    const all = new URL(req.url).searchParams.get("all") === "1";
    return NextResponse.json(await history(me.id, all));
  } catch (error) {
    console.error("Transfer history failed:", error);
    return NextResponse.json({ error: "The bank could not be reached." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const dead = await denyIfDead();
  if (dead) return dead;

  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = String(body.to ?? "").trim();
    const amount = Number(body.amount);
    const reference = String(body.reference ?? "").trim().slice(0, 60);

    if (!name) return NextResponse.json({ error: "Enter who you want to send money to." }, { status: 400 });
    if (!Number.isSafeInteger(amount) || amount < 1) {
      return NextResponse.json({ error: "Enter a whole-number amount." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { userId } });
      if (!me) throw new Refuse("Player not found.");

      const to = await tx.player.findFirst({
        where: { username: { equals: name, mode: "insensitive" } }
      });
      if (!to) throw new Refuse("There is nobody by that name.");
      if (to.id === me.id) throw new Refuse("You can't send money to yourself.");
      if (to.health <= 0) throw new Refuse("That player is dead.");

      const { received, fee } = splitTransfer(amount);

      const now = new Date();
      await settleInterest(tx, me.id, now);
      await settleInterest(tx, to.id, now);

      const paid = await tx.player.updateMany({
        where: { id: me.id, bank: { gte: amount } },
        data: { bank: { decrement: amount }, bankSince: now }
      });
      if (paid.count !== 1) throw new Refuse("You do not have that much in the bank.");

      await tx.player.update({ where: { id: to.id }, data: { bank: { increment: received }, bankSince: now } });

      await tx.transfer.create({
        data: {
          fromId: me.id,
          fromName: me.username,
          toId: to.id,
          toName: to.username,
          amount,
          fee,
          received,
          reference
        }
      });

      await tx.message.create({
        data: {
          toId: to.id,
          fromName: "The Bank",
          subject: "Money received",
          body: `${me.username} sent you £${amount.toLocaleString("en-GB")}. After the £${fee.toLocaleString("en-GB")} fee, £${received.toLocaleString("en-GB")} was paid into your bank account.${reference ? `\n\nReference: ${reference}` : ""}`
        }
      });

      const updated = await tx.player.findUnique({ where: { id: me.id }, select: { money: true, bank: true } });
      return { to: to.username, received, fee, money: updated?.money ?? 0, bank: updated?.bank ?? 0 };
    });

    const me = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
    const data = me ? await history(me.id, false) : {};
    return NextResponse.json({
      ok: true,
      message: `Sent £${amount.toLocaleString("en-GB")} to ${result.to}. They received £${result.received.toLocaleString("en-GB")} after the £${result.fee.toLocaleString("en-GB")} fee.`,
      money: result.money,
      bank: result.bank,
      ...data
    });
  } catch (error) {
    if (error instanceof Refuse) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Transfer failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
