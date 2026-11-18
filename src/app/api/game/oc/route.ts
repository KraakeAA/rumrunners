import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jailRemaining } from "@/lib/jail";
import { carModel } from "@/lib/era";
import {
  OC_CHOICES,
  OC_ITEMS,
  OC_ROLES,
  OC_START_COST,
  choiceForCarTier,
  roleName,
  rollVault,
  type OcChoice
} from "@/lib/oc";

const ROLE_KEYS = OC_ROLES.map((r) => r.key as string);

// Finds the crew a player belongs to: the one they lead, or the one they
// have joined (accepted slots only, not pending invitations).
async function findMyOc(playerId: string) {
  const led = await prisma.organisedCrime.findUnique({
    where: { leaderId: playerId },
    include: { slots: { include: { player: { select: { id: true, username: true } } } }, leader: { select: { username: true } } }
  });
  if (led) return led;

  const slot = await prisma.ocSlot.findFirst({
    where: { playerId, state: { in: ["selecting", "ready"] } },
    select: { ocId: true }
  });
  if (!slot) return null;

  return prisma.organisedCrime.findUnique({
    where: { id: slot.ocId },
    include: { slots: { include: { player: { select: { id: true, username: true } } } }, leader: { select: { username: true } } }
  });
}

export async function GET() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const me = await prisma.player.findUnique({ where: { userId } });

  if (!me) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const now = new Date();
  const oc = await findMyOc(me.id);

  // Invitations waiting for this player.
  const inviteSlots = await prisma.ocSlot.findMany({
    where: { playerId: me.id, state: "invited" },
    include: { oc: { include: { leader: { select: { username: true } } } } },
    orderBy: { id: "asc" }
  });

  const invites = inviteSlots.map((s) => ({
    ocId: s.ocId,
    leader: s.oc.leader.username,
    city: s.oc.city,
    role: s.role,
    roleName: roleName(s.role),
    percent: s.percent
  }));

  // Undamaged cars the player owns that no crew is already using.
  const used = await prisma.ocSlot.findMany({
    where: { carId: { not: null }, NOT: { playerId: me.id } },
    select: { carId: true }
  });
  const usedIds = used.map((u) => u.carId as string);

  const carRows = await prisma.car.findMany({
    where: { ownerId: me.id, damage: 0, id: { notIn: usedIds } },
    orderBy: { createdAt: "asc" }
  });

  const cars = carRows.flatMap((c) => {
    const m = carModel(c.model);
    return m ? [{ id: c.id, name: m.name, plate: c.plate, tier: m.tier }] : [];
  });

  let view = null;

  if (oc) {
    const isLeader = oc.leaderId === me.id;
    const members = oc.slots.reduce((sum, s) => sum + (s.state === "empty" ? 0 : s.percent ?? 0), 0);

    const everyoneReady = OC_ROLES.every((r) => oc.slots.find((x) => x.role === r.key)?.state === "ready");
    const sharesSet = OC_ROLES.every((r) => oc.slots.find((x) => x.role === r.key)?.percent !== null);

    view = {
      id: oc.id,
      everyoneReady,
      sharesSet,
      city: oc.city,
      leader: oc.leader.username,
      isLeader,
      leaderPercent: Math.max(0, 100 - members),
      slots: OC_ROLES.map((r) => {
        const s = oc.slots.find((x) => x.role === r.key);
        const car = s?.carId ? carRows.find((c) => c.id === s.carId) : undefined;
        const carInfo = car ? carModel(car.model) : undefined;
        const choice = (s?.choice as OcChoice | null) ?? null;

        return {
          role: r.key,
          roleName: r.name,
          state: s?.state ?? "empty",
          username: s?.player?.username ?? null,
          percent: s?.percent ?? null,
          choice,
          choiceLabel:
            choice && r.key !== "driver"
              ? OC_ITEMS[r.key as "weapons" | "explosives"][choice]
              : carInfo
                ? `${carInfo.name} (${car?.plate ?? ""})`
                : null,
          mine: s?.playerId === me.id
        };
      })
    };
  }

  return NextResponse.json({
    me: {
      city: me.currentCity,
      money: me.money,
      jailed: jailRemaining(me.jailUntil, now) > 0
    },
    startCost: OC_START_COST,
    oc: view,
    invites,
    cars
  });
}

type Db = Prisma.TransactionClient;

async function mail(
  tx: Db,
  toId: string,
  fromName: string,
  subject: string,
  body: string,
  ocId: string | null = null
) {
  await tx.message.create({ data: { toId, fromName, subject, body, ocId } });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  try {
    const message = await prisma.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { userId } });
      if (!me) throw new Error("PLAYER_NOT_FOUND");

      const now = new Date();
      const jailed = jailRemaining(me.jailUntil, now) > 0;

      const led = await tx.organisedCrime.findUnique({
        where: { leaderId: me.id },
        include: { slots: true }
      });

      const joined = await tx.ocSlot.findFirst({
        where: { playerId: me.id, state: { in: ["selecting", "ready"] } },
        include: { oc: true }
      });

      // ---------- START ----------
      if (action === "start") {
        if (jailed) throw new Error("JAILED");
        if (led || joined) throw new Error("ALREADY_IN_OC");

        const paid = await tx.player.updateMany({
          where: { id: me.id, money: { gte: OC_START_COST } },
          data: { money: { decrement: OC_START_COST } }
        });
        if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");

        await tx.organisedCrime.create({
          data: {
            leaderId: me.id,
            city: me.currentCity,
            slots: { create: OC_ROLES.map((r) => ({ role: r.key })) }
          }
        });

        return `You have started a crew in ${me.currentCity}. It cost £${OC_START_COST.toLocaleString("en-GB")}.`;
      }

      // ---------- ACCEPT / DECLINE ----------
      if (action === "accept" || action === "decline") {
        const ocId = String(body.ocId ?? "");
        const slot = await tx.ocSlot.findFirst({
          where: { ocId, playerId: me.id, state: "invited" },
          include: { oc: { include: { leader: { select: { id: true, username: true } } } } }
        });
        if (!slot) throw new Error("NO_INVITE");

        if (action === "decline") {
          await tx.ocSlot.update({
            where: { id: slot.id },
            data: { state: "empty", playerId: null, percent: null }
          });
          await mail(
            tx,
            slot.oc.leader.id,
            me.username,
            "Invitation declined",
            `${me.username} turned down the ${roleName(slot.role)} position in your crew.`,
            slot.ocId
          );
          return "You turned the offer down.";
        }

        if (jailed) throw new Error("JAILED");
        if (led || joined) throw new Error("ALREADY_IN_OC");
        if (me.currentCity !== slot.oc.city) throw new Error("WRONG_CITY:" + slot.oc.city);

        await tx.ocSlot.update({
          where: { id: slot.id },
          data: { state: "selecting" }
        });

        // Any other offers they were holding are now off the table.
        await tx.ocSlot.updateMany({
          where: { playerId: me.id, state: "invited", NOT: { id: slot.id } },
          data: { state: "empty", playerId: null, percent: null }
        });

        await mail(
          tx,
          slot.oc.leader.id,
          me.username,
          "Invitation accepted",
          `${me.username} has joined your crew as ${roleName(slot.role)}.`,
          slot.ocId
        );

        return `You have joined ${slot.oc.leader.username}'s crew as ${roleName(slot.role)}.`;
      }
