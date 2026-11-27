import { isHiddenStaff } from "@/lib/staff";
import { lockPlayerId } from "@/lib/lock";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { BOUNTY_MIN, REASON_MAX, bountyFee } from "@/lib/bounty";

class Refuse extends Error {}

async function view(meId: string) {
  const me = await prisma.player.findUnique({ where: { id: meId }, select: { money: true } });
  const rows = await prisma.bounty.findMany({
    where: { status: "active" },
    orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
    take: 50
  });
  return {
    money: me?.money ?? 0,
    meId,
    minimum: BOUNTY_MIN,
    reasonMax: REASON_MAX,
    bounties: rows.map((b) => ({
      id: b.id,
      targetId: b.targetId,
      targetName: b.targetName,
      amount: b.amount,
      paidBy: b.anonymous ? "Anonymous" : b.placerName,
      createdAt: b.createdAt.toISOString(),
      reason: b.reason
    }))
  };
}

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const me = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
    if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    return NextResponse.json(await view(me.id));
  } catch (error) {
    console.error("Hitlist load failed:", error);
    return NextResponse.json({ error: "The Hitlist could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const first = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
    if (!first) return NextResponse.json({ error: "Player not found." }, { status: 404 });

    let message = "";

    await prisma.$transaction(async (tx) => {
      await lockPlayerId(tx, first.id);
      const me = await tx.player.findUnique({ where: { id: first.id } });
      if (!me) throw new Refuse("Player not found.");
      if (me.health <= 0) throw new Refuse("You are dead.");

      if (action === "add") {
        const name = String(body.target ?? "").trim();
        const amount = Number(body.amount);
        const reason = String(body.reason ?? "").trim().slice(0, REASON_MAX);
        const anonymous = body.anonymous === true;

        if (!name) throw new Refuse("Enter the name of your target.");
        if (!Number.isSafeInteger(amount) || amount < BOUNTY_MIN) {
          throw new Refuse(`The smallest bounty is £${BOUNTY_MIN}.`);
        }

        const target = await tx.player.findFirst({
          where: { username: { equals: name, mode: "insensitive" } }
        });
        if (!target) throw new Refuse("There is nobody by that name.");
        const targetUser = await tx.user.findUnique({ where: { id: target.userId }, select: { isAdmin: true, staffRole: true } });
        if (isHiddenStaff(targetUser)) throw new Refuse("There is nobody by that name.");
        if (target.id === me.id) throw new Refuse("You can't put a price on your own head.");
        if (target.health <= 0) throw new Refuse("That man is already dead.");

        const fee = bountyFee(amount);
        const paid = await tx.player.updateMany({
          where: { id: me.id, money: { gte: amount + fee } },
          data: { money: { decrement: amount + fee } }
        });
        if (paid.count !== 1) throw new Refuse(`You need £${(amount + fee).toLocaleString("en-GB")} including the £${fee.toLocaleString("en-GB")} fee.`);

        await tx.bounty.create({
          data: {
            targetId: target.id,
            targetName: target.username,
            placerId: me.id,
            placerName: me.username,
            amount,
            reason,
            anonymous
          }
        });
        message = `A £${amount.toLocaleString("en-GB")} bounty is now on ${target.username}. The fee was £${fee.toLocaleString("en-GB")}.`;
        return;
      }

      if (action === "buyoff") {
        const bounty = await tx.bounty.findUnique({ where: { id: String(body.id ?? "") } });
        if (!bounty || bounty.status !== "active") throw new Refuse("That bounty is already gone.");
        // Anyone can pay a bounty off. The bounty is claimed first so two people can't both pay for it.
        const claimed = await tx.bounty.updateMany({
          where: { id: bounty.id, status: "active" },
          data: { status: "bought_off", resolvedAt: new Date() }
        });
        if (claimed.count !== 1) throw new Refuse("That bounty is already gone.");

        const paid = await tx.player.updateMany({
          where: { id: me.id, money: { gte: bounty.amount } },
          data: { money: { decrement: bounty.amount } }
        });
        if (paid.count !== 1) throw new Refuse("You can't afford to buy that off.");

        message =
          bounty.targetId === me.id
            ? `You paid £${bounty.amount.toLocaleString("en-GB")} and the bounty is gone.`
            : `You paid £${bounty.amount.toLocaleString("en-GB")} and the bounty on ${bounty.targetName} is gone.`;
        return;
      }

      throw new Refuse("Unknown action.");
    });

    const data = await view(first.id);
    return NextResponse.json({ ok: true, message, ...data });
  } catch (error) {
    if (error instanceof Refuse) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Hitlist failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
