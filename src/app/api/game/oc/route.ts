import { denyIfDead } from "@/lib/alive";
import { lockPlayer } from "@/lib/lock";
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
    where: { ownerId: me.id, damage: 0, escrowId: null, id: { notIn: usedIds } },
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
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  try {
    const message = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
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

      // ---------- CHOOSE ITEMS ----------
      if (action === "choose") {
        if (jailed) throw new Error("JAILED");
        if (!joined) throw new Error("NOT_IN_OC");
        if (me.currentCity !== joined.oc.city) throw new Error("WRONG_CITY:" + joined.oc.city);

        if (joined.role === "driver") {
          const carId = String(body.carId ?? "");
          const car = await tx.car.findFirst({ where: { id: carId, ownerId: me.id, escrowId: null } });
          const model = car ? carModel(car.model) : undefined;
          if (!car || !model) throw new Error("NO_CAR");
          if (car.damage > 0) throw new Error("CAR_DAMAGED");

          const taken = await tx.ocSlot.findFirst({
            where: { carId: car.id, NOT: { id: joined.id } }
          });
          if (taken) throw new Error("CAR_TAKEN");

          await tx.ocSlot.update({
            where: { id: joined.id },
            data: { state: "ready", carId: car.id, choice: choiceForCarTier(model.tier) }
          });
          return `The ${model.name} is ready.`;
        }

        const choice = String(body.choice ?? "") as OcChoice;
        if (!OC_CHOICES.includes(choice)) throw new Error("BAD_CHOICE");

        await tx.ocSlot.update({
          where: { id: joined.id },
          data: { state: "ready", choice }
        });
        return `You have chosen: ${OC_ITEMS[joined.role as "weapons" | "explosives"][choice]}.`;
      }

      // ---------- LEAVE ----------
      if (action === "leave") {
        if (!joined) throw new Error("NOT_IN_OC");

        const leader = await tx.player.findUnique({
          where: { id: joined.oc.leaderId },
          select: { id: true }
        });

        await tx.ocSlot.update({
          where: { id: joined.id },
          data: { state: "empty", playerId: null, percent: null, choice: null, carId: null }
        });

        if (leader) {
          await mail(
            tx,
            leader.id,
            me.username,
            "Crew member left",
            `${me.username} has left your crew. The ${roleName(joined.role)} position is open again.`,
            joined.ocId
          );
        }
        return "You have left the crew.";
      }

      // Everything below belongs to the leader.
      if (!led) throw new Error("NOT_LEADER");

      // ---------- COMMIT ----------
      if (action === "commit") {
        if (jailed) throw new Error("JAILED");
        if (me.currentCity !== led.city) throw new Error("LEADER_ELSEWHERE");

        const find = (role: string) => led.slots.find((s) => s.role === role);
        const weapons = find("weapons");
        const explosives = find("explosives");
        const driver = find("driver");

        if (
          !weapons || !explosives || !driver ||
          [weapons, explosives, driver].some((s) => s.state !== "ready" || !s.playerId)
        ) {
          throw new Error("NOT_READY");
        }
        if ([weapons, explosives, driver].some((s) => s.percent === null)) {
          throw new Error("SHARES_UNSET");
        }

        // Nobody on the job may have died since they signed up.
        const crewmen = await tx.player.findMany({
          where: { id: { in: [weapons, explosives, driver].map((x) => x.playerId as string) } },
          select: { health: true, username: true, currentCity: true }
        });
        if (crewmen.length !== 3 || crewmen.some((c) => c.health <= 0)) throw new Error("MEMBER_DEAD");

        // Members may travel after they are ready, but every one of them has to be
        // back in the crew's city when the job is committed.
        const away = crewmen.filter((c) => c.currentCity !== led.city);
        if (away.length > 0) throw new Error("MEMBER_ELSEWHERE:" + away.map((c) => c.username).join(", "));

        // The driver's car must still be there, theirs, and undamaged.
        const car = driver.carId
          ? await tx.car.findFirst({ where: { id: driver.carId, ownerId: driver.playerId as string } })
          : null;
        const carInfo = car ? carModel(car.model) : undefined;
        if (!car || !carInfo || car.damage > 0) {
          throw new Error("DRIVER_CAR_BAD");
        }

        const take = rollVault({
          weapons: weapons.choice as OcChoice,
          explosives: explosives.choice as OcChoice,
          driver: driver.choice as OcChoice
        });

        const members = [weapons, explosives, driver].map((s) => ({
          playerId: s.playerId as string,
          role: s.role,
          percent: s.percent as number,
          amount: Math.floor((take.vault * (s.percent as number)) / 100)
        }));
        const memberTotal = members.reduce((n, m) => n + m.amount, 0);
        const memberPercent = members.reduce((n, m) => n + m.percent, 0);
        const leaderPercent = Math.max(0, 100 - memberPercent);
        const leaderAmount = take.vault - memberTotal;

        const payouts = [
          { playerId: me.id, role: "leader", percent: leaderPercent, amount: leaderAmount },
          ...members
        ];

        for (const p of payouts) {
          await tx.player.update({
            where: { id: p.playerId },
            data: {
              money: { increment: Math.max(0, p.amount) },
              ocsDone: { increment: 1 },
              ocEarned: { increment: Math.max(0, p.amount) },
              ...(p.role === "leader" ? { ocsLed: { increment: 1 } } : {})
            }
          });

          await mail(
            tx,
            p.playerId,
            me.username,
            "Organised crime successful",
            [
              `The job in ${led.city} was a success.`,
              ``,
              `Vault take: £${take.vault.toLocaleString("en-GB")}`,
              take.boostNote,
              `Your percentage: ${p.percent}%`,
              `You received: £${p.amount.toLocaleString("en-GB")}`
            ]
              .filter((line, i, all) => line !== "" || all[i - 1] !== "")
              .join("\n")
          );
        }

        await tx.organisedCrime.delete({ where: { id: led.id } });

        return `Job done. The vault held £${take.vault.toLocaleString("en-GB")} and you took ${leaderPercent}%: £${leaderAmount.toLocaleString("en-GB")}.${take.boostNote ? " " + take.boostNote : ""}`;
      }

      // ---------- DISBAND ----------
      if (action === "disband") {
        const people = led.slots.filter((s) => s.playerId);
        for (const s of people) {
          await mail(
            tx,
            s.playerId as string,
            me.username,
            "Crew disbanded",
            `${me.username} has disbanded their crew in ${led.city}.`
          );
        }
        await tx.organisedCrime.delete({ where: { id: led.id } });
        return "The crew has been disbanded.";
      }

      const role = String(body.role ?? "");
      if (!ROLE_KEYS.includes(role)) throw new Error("BAD_ROLE");
      const slot = led.slots.find((s) => s.role === role);
      if (!slot) throw new Error("BAD_ROLE");

      const parsePercent = (): number | null => {
        const raw = body.percent;
        if (raw === null || raw === undefined || raw === "") return null;
        const n = Math.floor(Number(raw));
        if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("BAD_PERCENT");
        const others = led.slots
          .filter((s) => s.role !== role && s.state !== "empty")
          .reduce((sum, s) => sum + (s.percent ?? 0), 0);
        if (others + n > 100) throw new Error("PERCENT_TOTAL");
        return n;
      };

      // ---------- SET PERCENT ----------
      if (action === "percent") {
        if (slot.state === "empty") throw new Error("SLOT_EMPTY");
        // Once someone has joined on an agreed share it can't be cut behind their back.
        // To change it, remove them and invite them again.
        if (slot.state !== "invited" && slot.percent !== null) throw new Error("SHARE_LOCKED");
        await tx.ocSlot.update({ where: { id: slot.id }, data: { percent: parsePercent() } });
        return "Share updated.";
      }

      // ---------- KICK / WITHDRAW ----------
      if (action === "kick") {
        if (slot.state === "empty" || !slot.playerId) throw new Error("SLOT_EMPTY");

        const wasInvite = slot.state === "invited";
        await tx.ocSlot.update({
          where: { id: slot.id },
          data: { state: "empty", playerId: null, percent: null, choice: null, carId: null }
        });
        await mail(
          tx,
          slot.playerId,
          me.username,
          wasInvite ? "Invitation withdrawn" : "Removed from crew",
          wasInvite
            ? `${me.username} has withdrawn the ${roleName(role)} invitation.`
            : `${me.username} has removed you from their crew in ${led.city}.`,
          led.id
        );
        return wasInvite ? "Invitation withdrawn." : "They have been removed from the crew.";
      }

      // ---------- INVITE ----------
      if (action === "invite") {
        if (slot.state !== "empty") throw new Error("SLOT_TAKEN");

        const name = String(body.username ?? "").trim();
        if (!name) throw new Error("NO_NAME");

        const target = await tx.player.findFirst({
          where: { username: { equals: name, mode: "insensitive" } },
          select: { id: true, username: true }
        });
        if (!target) throw new Error("NO_SUCH_PLAYER");
        if (target.id === me.id) throw new Error("SELF_INVITE");
        const targetAlive = await tx.player.findUnique({ where: { id: target.id }, select: { health: true } });
        if (!targetAlive || targetAlive.health <= 0) throw new Error("NO_SUCH_PLAYER");

        const theirs = await tx.organisedCrime.findUnique({ where: { leaderId: target.id } });
        const theirJoined = await tx.ocSlot.findFirst({
          where: { playerId: target.id, state: { in: ["selecting", "ready"] } }
        });
        if (theirs || theirJoined) throw new Error("TARGET_BUSY");

        const already = await tx.ocSlot.findFirst({
          where: { ocId: led.id, playerId: target.id }
        });
        if (already) throw new Error("ALREADY_ASKED");

        const percent = parsePercent();

        await tx.ocSlot.update({
          where: { id: slot.id },
          data: { state: "invited", playerId: target.id, percent, choice: null, carId: null }
        });

        await mail(
          tx,
          target.id,
          me.username,
          "Organised crime invitation",
          [
            `${me.username} invited you to join their organised crime.`,
            ``,
            `City: ${led.city}`,
            `Position: ${roleName(role)}`,
            `Your share: ${percent === null ? "Not currently set" : percent + "%"}`,
            ``,
            `To accept, be in ${led.city} and open the Organised Crime page.`
          ].join("\n"),
          led.id
        );

        return `${target.username} has been invited as ${roleName(role)}.`;
      }

      throw new Error("BAD_ACTION");
    });

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";

    if (m.startsWith("MEMBER_ELSEWHERE:")) {
      const names = m.slice("MEMBER_ELSEWHERE:".length);
      return NextResponse.json(
        { error: `Everyone has to be in the crew's city to commit. Not there yet: ${names}.` },
        { status: 400 }
      );
    }

    if (m.startsWith("WRONG_CITY:")) {
      return NextResponse.json(
        { error: `You have to be in ${m.split(":")[1]} for that.` },
        { status: 400 }
      );
    }

    const map: Record<string, [string, number]> = {
      PLAYER_NOT_FOUND: ["Player not found.", 404],
      JAILED: ["You can't do that from a prison cell.", 403],
      ALREADY_IN_OC: ["You are already part of a crew.", 400],
      INSUFFICIENT_FUNDS: ["You do not have enough cash to start a crew.", 400],
      NO_INVITE: ["That invitation is no longer open.", 400],
      NOT_IN_OC: ["You are not in a crew.", 400],
      NOT_LEADER: ["Only the leader can do that.", 403],
      NO_CAR: ["You do not own that car.", 400],
      CAR_TAKEN: ["That car is already committed to a crew.", 400],
      BAD_CHOICE: ["Pick one of the three options.", 400],
      CAR_DAMAGED: ["That car is damaged. Only cars at 0% damage can be driven on a job.", 400],
      NOT_READY: ["Everyone has to be ready before you can commit.", 400],
      SHARES_UNSET: ["Set a share for every crew member first.", 400],
      LEADER_ELSEWHERE: ["You have to be in the crew's city to commit.", 400],
      DRIVER_CAR_BAD: ["The driver's car is no longer fit to drive. Ask them to pick another.", 400],
      BAD_ROLE: ["Unknown position.", 400],
      BAD_PERCENT: ["A share must be a whole number from 0 to 100.", 400],
      SHARE_LOCKED: ["That share was agreed when they joined. Remove them and invite them again to change it.", 400],
      MEMBER_DEAD: ["One of your crew has died. Remove them and invite someone else.", 400],
      PERCENT_TOTAL: ["The shares can't add up to more than 100%.", 400],
      SLOT_EMPTY: ["That position is empty.", 400],
      SLOT_TAKEN: ["That position is already filled or offered.", 400],
      NO_NAME: ["Type the name of the player to invite.", 400],
      NO_SUCH_PLAYER: ["There is no player with that name.", 404],
      SELF_INVITE: ["You are already the leader.", 400],
      TARGET_BUSY: ["That player is already in a crew.", 400],
      ALREADY_ASKED: ["That player already has an offer from you.", 400],
      BAD_ACTION: ["Unknown action.", 400]
    };

    if (map[m]) {
      return NextResponse.json({ error: map[m][0] }, { status: map[m][1] });
    }

    console.error("Organised crime failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
