import { NextResponse } from "next/server";
import { lockPlayer } from "@/lib/lock";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { denyIfDead } from "@/lib/alive";
import { splitTransfer, TRANSFER_FEE } from "@/lib/fees";
import { carModel } from "@/lib/era";
import { casinoDef, OPENING_WINDOW_MS } from "@/lib/venues";
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
      prisma.casino.findMany({ where: { ownerId: me.id, escrowId: null, game: { not: "War" } }, orderBy: { city: "asc" } })
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
      // The chips inside go back to the seller as cash. The buyer starts with an
      // empty casino and a five minute window to stock it.
      const held = await tx.casino.findUnique({ where: { id: item.casinoId }, select: { chips: true } });
      if (held && held.chips > 0) {
        await tx.player.update({ where: { id: from.id }, data: { money: { increment: held.chips } } });
      }
      await tx.casino.update({
        where: { id: item.casinoId },
        data: {
          ownerId: to.id,
          escrowId: null,
          ownedSince: new Date(),
          chips: 0,
          openAt: new Date(Date.now() + OPENING_WINDOW_MS),
          profit: 0,
          plays: 0,
          wagered: 0
        }
      });
    }
  }

