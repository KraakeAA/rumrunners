import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { denyIfDead } from "@/lib/alive";
import { splitTransfer, TRANSFER_FEE } from "@/lib/fees";
import { carModel } from "@/lib/era";
import { casinoDef } from "@/lib/venues";
import {
  MAX_AMOUNT,
  MAX_ITEMS_PER_SIDE,
  MAX_OPEN_ESCROWS,
  cancelEscrow,
  escrowDeadline,
  expireEscrowsFor
} from "@/lib/escrow";
import type { Prisma } from "@prisma/client";

class Refuse extends Error {}
type Tx = Prisma.TransactionClient;

const kindLabel = (kind: string) =>
  kind === "cash" ? "Cash" : kind === "gold" ? "Gold" : kind === "casino" ? "Casino" : "Car";

// ---------- reading ----------

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const who = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
    if (!who) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    await expireEscrowsFor(prisma, who.id);
    const me = await prisma.player.findUnique({ where: { userId } });
    if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

    const [escrows, carRows, committed, casinoRows] = await Promise.all([
      prisma.escrow.findMany({
        where: { status: { in: ["invited", "active"] }, OR: [{ aId: me.id }, { bId: me.id }] },
        include: { items: { orderBy: { createdAt: "asc" } } },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.car.findMany({ where: { ownerId: me.id, escrowId: null }, orderBy: { createdAt: "asc" } }),
      prisma.ocSlot.findMany({ where: { playerId: me.id, carId: { not: null } }, select: { carId: true } }),
      prisma.casino.findMany({ where: { ownerId: me.id, escrowId: null }, orderBy: { city: "asc" } })
    ]);
    const busyCars = new Set(committed.map((c) => c.carId as string));

    return NextResponse.json({
      meName: me.username,
      money: me.money,
      gold: me.gold,
      feePercent: Math.round(TRANSFER_FEE * 100),
      maxItems: MAX_ITEMS_PER_SIDE,
      cars: carRows
        .filter((c) => !busyCars.has(c.id))
        .flatMap((c) => {
          const m = carModel(c.model);
          return m ? [{ id: c.id, name: m.name, plate: c.plate, city: c.city }] : [];
        }),
      casinos: casinoRows.map((c) => ({ id: c.id, name: `${casinoDef(c.game).label} in ${c.city}` })),
      escrows: escrows.map((e) => {
        const mineIsA = e.aId === me.id;
        return {
          id: e.id,
          status: e.status,
          fromMe: mineIsA, // I sent the invitation
          expiresAt: e.expiresAt ? e.expiresAt.toISOString() : null,
          other: mineIsA ? e.bName : e.aName,
          myLocked: mineIsA ? e.aLocked : e.bLocked,
          theirLocked: mineIsA ? e.bLocked : e.aLocked,
          myAgreed: mineIsA ? e.aAgreed : e.bAgreed,
          theirAgreed: mineIsA ? e.bAgreed : e.aAgreed,
          items: e.items.map((i) => ({
            id: i.id,
            mine: i.ownerId === me.id,
            kind: i.kind,
            amount: i.amount,
            carName: i.carName
          }))
        };
      })
    });
  } catch (error) {
    console.error("Escrow load failed:", error);
    return NextResponse.json({ error: "The Escrow office could not be reached." }, { status: 500 });
  }
}

// ---------- finishing a trade ----------

async function complete(tx: Tx, escrowId: string) {
  const e = await tx.escrow.findUnique({ where: { id: escrowId }, include: { items: true } });
  if (!e) throw new Refuse("That escrow has gone.");

  const a = await tx.player.findUnique({ where: { id: e.aId } });
  const b = await tx.player.findUnique({ where: { id: e.bId } });
  if (!a || !b) throw new Refuse("One of you can no longer be found.");
  if (a.health <= 0 || b.health <= 0) throw new Refuse("Both of you need to be alive to finish the trade.");

  // Each garage must have room for the cars coming in.
  const carsFromA = e.items.filter((i) => i.kind === "car" && i.ownerId === a.id).length;
  const carsFromB = e.items.filter((i) => i.kind === "car" && i.ownerId === b.id).length;
  const [ownedA, ownedB] = await Promise.all([
    tx.car.count({ where: { ownerId: a.id } }),
    tx.car.count({ where: { ownerId: b.id } })
  ]);
  if (ownedA - carsFromA + carsFromB > a.garageSlots) throw new Refuse(`${a.username}'s garage is too full for those cars.`);
  if (ownedB - carsFromB + carsFromA > b.garageSlots) throw new Refuse(`${b.username}'s garage is too full for those cars.`);

  for (const item of e.items) {
    const to = item.ownerId === a.id ? b : a;
    const from = item.ownerId === a.id ? a : b;

    if (item.kind === "cash") {
      const { received, fee } = splitTransfer(item.amount);
      await tx.player.update({ where: { id: to.id }, data: { money: { increment: received } } });
      await tx.transfer.create({
        data: {
          fromId: from.id,
          fromName: from.username,
          toId: to.id,
          toName: to.username,
          amount: item.amount,
          fee,
          received,
          reference: "Escrow trade",
          kind: "escrow"
        }
      });
    } else if (item.kind === "gold") {
      await tx.player.update({ where: { id: to.id }, data: { gold: { increment: item.amount } } });
    } else if (item.kind === "car" && item.carId) {
      await tx.car.update({ where: { id: item.carId }, data: { ownerId: to.id, escrowId: null } });
    } else if (item.kind === "casino" && item.casinoId) {
      await tx.casino.update({
        where: { id: item.casinoId },
        data: { ownerId: to.id, escrowId: null, ownedSince: new Date(), profit: 0, plays: 0, wagered: 0 }
      });
    }
  }

  await tx.escrowItem.deleteMany({ where: { escrowId } });
  await tx.escrow.update({
    where: { id: escrowId },
    data: { status: "completed", completedAt: new Date() }
  });
}

// ---------- actions ----------

export async function POST(req: Request) {
  const dead = await denyIfDead();
  if (dead) return dead;

  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const id = String(body.id ?? "");

    const message = await prisma.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { userId } });
      if (!me) throw new Refuse("Player not found.");

      // ---- Invite someone ----
      if (action === "invite") {
        const name = String(body.username ?? "").trim();
        if (!name) throw new Refuse("Enter who you want to trade with.");
        const other = await tx.player.findFirst({ where: { username: { equals: name, mode: "insensitive" } } });
        if (!other) throw new Refuse("Nobody by that name.");
        if (other.id === me.id) throw new Refuse("You can't trade with yourself.");
        if (other.health <= 0) throw new Refuse("That player is dead.");

        const already = await tx.escrow.findFirst({
          where: {
            status: { in: ["invited", "active"] },
            expiresAt: { gt: new Date() },
            OR: [
              { aId: me.id, bId: other.id },
              { aId: other.id, bId: me.id }
            ]
          }
        });
        if (already) throw new Refuse("You already have an escrow open with that player.");

        const open = await tx.escrow.count({
          where: { status: { in: ["invited", "active"] }, expiresAt: { gt: new Date() }, OR: [{ aId: me.id }, { bId: me.id }] }
        });
        if (open >= MAX_OPEN_ESCROWS) throw new Refuse(`You can only have ${MAX_OPEN_ESCROWS} escrows open at once.`);

        await tx.escrow.create({
          data: { aId: me.id, aName: me.username, bId: other.id, bName: other.username, expiresAt: escrowDeadline() }
        });
        await tx.message.create({
          data: {
            toId: other.id,
            fromName: "Escrow Agent",
            subject: `Escrow invitation from ${me.username}`,
            body: `${me.username} has asked to trade with you through the Escrow office. Open Escrow from the menu to accept or decline.`
          }
        });
        return `Invitation sent to ${other.username}. They need to accept before you can trade.`;
      }

      // Everything below works on one escrow. Lock its row so two quick taps can't clash.
      if (!id) throw new Refuse("Choose an escrow.");
      await tx.$queryRaw`SELECT id FROM "Escrow" WHERE id = ${id} FOR UPDATE`;
      const e = await tx.escrow.findUnique({ where: { id } });
      if (!e || (e.aId !== me.id && e.bId !== me.id)) throw new Refuse("That escrow isn't yours.");
      if (e.status !== "invited" && e.status !== "active") throw new Refuse("That escrow has finished.");

      // Out of time: call it off and hand everything back.
      if (e.expiresAt && e.expiresAt.getTime() <= Date.now()) {
        await cancelEscrow(tx, id);
        return "That escrow ran out of time and was cancelled. Everything has gone back to its owner.";
      }

      const mineIsA = e.aId === me.id;
      const otherName = mineIsA ? e.bName : e.aName;

      if (action === "accept") {
        if (e.status !== "invited" || mineIsA) throw new Refuse("There's no invitation to accept.");
        await tx.escrow.update({ where: { id }, data: { status: "active", expiresAt: escrowDeadline() } });
        return `You accepted. Add what you want to trade with ${otherName}.`;
      }

      if (action === "decline") {
        if (e.status !== "invited" || mineIsA) throw new Refuse("There's no invitation to decline.");
        await tx.escrow.update({ where: { id }, data: { status: "cancelled" } });
        return "Invitation declined.";
      }

      if (action === "cancel") {
        await cancelEscrow(tx, id);
        return "Escrow cancelled. Everything has gone back to its owner.";
      }

      // The rest only make sense once both are in.
      if (e.status !== "active") throw new Refuse("Wait for the invitation to be accepted.");

      if (action === "add") {
        if (mineIsA ? e.aLocked : e.bLocked) throw new Refuse("You've accepted, so your offer is locked in. Cancel the escrow to start again.");
        const kind = String(body.kind ?? "");
        const mine = await tx.escrowItem.count({ where: { escrowId: id, ownerId: me.id } });

        if (kind === "cash" || kind === "gold") {
          const amount = Math.floor(Number(body.amount));
          if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
            throw new Refuse("Enter a whole amount.");
          }
          const taken =
            kind === "cash"
              ? await tx.player.updateMany({
                  where: { id: me.id, money: { gte: amount } },
                  data: { money: { decrement: amount } }
                })
              : await tx.player.updateMany({
                  where: { id: me.id, gold: { gte: amount } },
                  data: { gold: { decrement: amount } }
                });
          if (taken.count !== 1) throw new Refuse(kind === "cash" ? "You do not have that much cash on hand." : "You do not have that much gold.");

          const line = await tx.escrowItem.findFirst({ where: { escrowId: id, ownerId: me.id, kind } });
          if (line) {
            await tx.escrowItem.update({ where: { id: line.id }, data: { amount: { increment: amount } } });
          } else {
            if (mine >= MAX_ITEMS_PER_SIDE) throw new Refuse(`You can offer at most ${MAX_ITEMS_PER_SIDE} things.`);
            await tx.escrowItem.create({ data: { escrowId: id, ownerId: me.id, kind, amount } });
          }
        } else if (kind === "car") {
          if (mine >= MAX_ITEMS_PER_SIDE) throw new Refuse(`You can offer at most ${MAX_ITEMS_PER_SIDE} things.`);
          const carId = String(body.carId ?? "");
          const car = await tx.car.findFirst({ where: { id: carId, ownerId: me.id, escrowId: null } });
          const model = car ? carModel(car.model) : undefined;
          if (!car || !model) throw new Refuse("Choose one of your cars.");
          const inOc = await tx.ocSlot.count({ where: { carId: car.id } });
          if (inOc > 0) throw new Refuse("That car is committed to an organised crime.");

          const held = await tx.car.updateMany({ where: { id: car.id, escrowId: null }, data: { escrowId: id } });
          if (held.count !== 1) throw new Refuse("That car is already in a trade.");
          await tx.escrowItem.create({
            data: {
              escrowId: id,
              ownerId: me.id,
              kind: "car",
              carId: car.id,
              carName: car.plate ? `${model.name} (${car.plate})` : model.name
            }
          });
        } else if (kind === "casino") {
          if (mine >= MAX_ITEMS_PER_SIDE) throw new Refuse(`You can offer at most ${MAX_ITEMS_PER_SIDE} things.`);
          const casinoId = String(body.casinoId ?? "");
          const casino = await tx.casino.findFirst({ where: { id: casinoId, ownerId: me.id, escrowId: null } });
          if (!casino) throw new Refuse("Choose a casino you own.");

          const held = await tx.casino.updateMany({ where: { id: casino.id, ownerId: me.id, escrowId: null }, data: { escrowId: id } });
          if (held.count !== 1) throw new Refuse("That casino is already in a trade.");
          await tx.escrowItem.create({
            data: {
              escrowId: id,
              ownerId: me.id,
              kind: "casino",
              casinoId: casino.id,
              carName: `${casinoDef(casino.game).label} in ${casino.city}`
            }
          });
        } else {
          throw new Refuse("You can only trade cash, gold, cars and casinos.");
        }

        return `${kindLabel(kind)} added.`;
      }

      if (action === "lock") {
        await tx.escrow.update({
          where: { id },
          data: mineIsA ? { aLocked: true } : { bLocked: true }
        });
        return "Accepted. Your offer is now locked in. When both of you have accepted, you each go on to agree.";
      }

      if (action === "agree") {
        if (!e.aLocked || !e.bLocked) throw new Refuse("Both of you must accept the offers first.");
        const aAgreed = mineIsA ? true : e.aAgreed;
        const bAgreed = mineIsA ? e.bAgreed : true;
        await tx.escrow.update({ where: { id }, data: { aAgreed, bAgreed } });

        if (aAgreed && bAgreed) {
          await complete(tx, id);
          return "Trade complete. The agent has handed everything over.";
        }
        return `You agreed. Waiting for ${otherName}.`;
      }

      throw new Refuse("Unknown action.");
    });

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    if (error instanceof Refuse) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Escrow action failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
