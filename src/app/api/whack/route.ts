import { isHiddenStaff } from "@/lib/staff";
import { userTag } from "@/lib/mailtext";
import { lockPlayerId } from "@/lib/lock";
import { cancelLedOc } from "@/lib/oc";
import { isAdminUser, strengthFor } from "@/lib/admin-bypass";
import { rankForLevel } from "@/lib/ranks";
import { dropCasinosOf, sendWitnessStatements } from "@/lib/death";
import { levelFromXp } from "@/lib/game";
import { notifyPromotion } from "@/lib/promotion";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jailRemaining } from "@/lib/jail";
import { cleanEquipped, equipmentStats } from "@/lib/store";
import {
  DETECTIVES,
  bulletsToKill,
  isShielded,
  regenHealth,
  rollFindMinutes,
  rollLuck,
  settleHunts,
  windowMinutesFor
} from "@/lib/whack";

class Refuse extends Error {}

async function view(playerId: string) {
  const me = await prisma.player.findUnique({ where: { id: playerId } });
  if (!me) return null;

  await settleHunts(playerId);

  const hunts = await prisma.hunt.findMany({
    where: { hunterId: playerId },
    orderBy: { createdAt: "desc" },
    take: 15
  });

  const statements = await prisma.statement.findMany({
    where: { ownerId: playerId },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  const now = new Date();
  const stats = equipmentStats(cleanEquipped(me.equipped), strengthFor(await isAdminUser(me.userId), me.strengthPts));

  return {
    money: me.money,
    city: me.currentCity,
    firepower: stats.firepower,
    shielded: isShielded(me, now),
    shieldUntil: me.shieldUntil ? me.shieldUntil.toISOString() : null,
    bullets: me.bullets,
    detectives: DETECTIVES,
    statements: statements.map((x) => ({
      id: x.id,
      victimName: x.victimName,
      city: x.city,
      createdAt: x.createdAt.toISOString(),
      inEscrow: x.escrowId !== null,
      opened: x.opened,
      // Who did it is only ever sent once the statement has been opened.
      killerName: x.opened ? x.killerName : null
    })),
    hunts: hunts.map((h) => ({
      id: h.id,
      targetName: h.targetName,
      tier: h.tier,
      status: h.status,
      foundAt: h.foundAt.toISOString(),
      foundCity: h.foundCity,
      windowEndsAt: h.windowEndsAt ? h.windowEndsAt.toISOString() : null,
      shots: h.shots
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
    console.error("Whack load failed:", error);
    return NextResponse.json({ error: "The detectives could not be reached." }, { status: 500 });
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
    await settleHunts(first.id);

    let message = "";

    await prisma.$transaction(async (tx) => {
      await lockPlayerId(tx, first.id);
      const me = await tx.player.findUnique({ where: { id: first.id } });
      if (!me) throw new Refuse("Player not found.");
      if (me.health <= 0) throw new Refuse("You are dead.");
      const now = new Date();

      // Opening a witness statement works from anywhere, even a cell. It can't be undone.
      if (action === "openStatement") {
        const st = await tx.statement.findFirst({ where: { id: String(body.id ?? ""), ownerId: me.id } });
        if (!st) throw new Refuse("No such statement.");
        if (st.escrowId) throw new Refuse("That statement is in an escrow trade.");
        if (!st.opened) await tx.statement.update({ where: { id: st.id }, data: { opened: true } });
        message = `${st.killerName} shot ${st.victimName} in ${st.city}.`;
        return;
      }

      const admin = await isAdminUser(userId, tx);
      if (!admin && jailRemaining(me.jailUntil, now) > 0) throw new Refuse("You can't do that from a prison cell.");

      if (action === "hire") {
        const detective = DETECTIVES.find((d) => d.key === String(body.tier ?? ""));
        if (!detective) throw new Refuse("Choose a detective.");

        const name = String(body.target ?? "").trim();
        if (!name) throw new Refuse("Enter the name of the man you want found.");

        const target = await tx.player.findFirst({
          where: { username: { equals: name, mode: "insensitive" } }
        });
        if (!target) throw new Refuse("There is nobody by that name.");
        const targetUser = await tx.user.findUnique({ where: { id: target.userId }, select: { isAdmin: true, staffRole: true } });
        if (isHiddenStaff(targetUser)) throw new Refuse("There is nobody by that name.");
        if (target.id === me.id) throw new Refuse("You can't hire a detective to find yourself.");
        if (target.health <= 0) throw new Refuse("That man is already dead.");
        if (!admin && isShielded(target, now)) throw new Refuse("That player is new to the city and under protection.");

        const open = await tx.hunt.findFirst({
          where: { hunterId: me.id, targetId: target.id, status: { in: ["searching", "found"] } }
        });
        if (open) throw new Refuse("You already have a detective on that man.");

        const paid = await tx.player.updateMany({
          where: { id: me.id, money: { gte: detective.price } },
          data: { money: { decrement: detective.price } }
        });
        if (paid.count !== 1) throw new Refuse("You can't afford that detective.");

        // Going after someone ends your own protection.
        if (me.shieldUntil) {
          await tx.player.update({ where: { id: me.id }, data: { shieldUntil: null } });
        }

        await tx.hunt.create({
          data: {
            hunterId: me.id,
            targetId: target.id,
            targetName: target.username,
            tier: detective.key,
            cost: detective.price,
            foundAt: admin ? now : new Date(now.getTime() + Math.round(rollFindMinutes(detective) * 60_000))
          }
        });
        message = `The ${detective.name} is on the case. He will report some time in the next ${Math.round(detective.minMinutes / 60 * 10) / 10}–${Math.round(detective.maxMinutes / 60 * 10) / 10} hours (it could be any moment), and you will get a letter when ${target.username} is found. You will then have ${detective.windowMinutes} minutes to take your one shot.`;
        return;
      }

      if (action === "shoot") {
        const hunt = await tx.hunt.findUnique({ where: { id: String(body.id ?? "") } });
        if (!hunt || hunt.hunterId !== me.id) throw new Refuse("No such job.");
        if (admin && hunt.status === "searching") {
          const t = await tx.player.findUnique({ where: { id: hunt.targetId }, select: { currentCity: true } });
          await tx.hunt.update({
            where: { id: hunt.id },
            data: { status: "found", foundCity: t?.currentCity ?? me.currentCity, windowEndsAt: new Date(now.getTime() + windowMinutesFor(hunt.tier) * 60_000) }
          });
          hunt.status = "found";
          hunt.foundCity = t?.currentCity ?? me.currentCity;
          hunt.windowEndsAt = new Date(now.getTime() + windowMinutesFor(hunt.tier) * 60_000);
        }
        if (!admin && (hunt.status !== "found" || !hunt.windowEndsAt || hunt.windowEndsAt <= now)) {
          throw new Refuse("The trail has gone cold. You will need to hire again.");
        }
        if (!admin && me.currentCity !== hunt.foundCity) {
          throw new Refuse(`You need to be in ${hunt.foundCity} to take the shot.`);
        }

        const stats = equipmentStats(cleanEquipped(me.equipped), strengthFor(admin, me.strengthPts));
        if (!admin && stats.firepower <= 0) throw new Refuse("You need a gun in your hand. Equip one from your Character.");

        // Lock the target so two shooters can't both "kill" him and both collect the bounties.
        await lockPlayerId(tx, hunt.targetId);
        const target = await tx.player.findUnique({ where: { id: hunt.targetId } });
        if (!target || target.health <= 0) {
          // Written outside the transaction so the refusal below does not undo it.
          await prisma.hunt.update({ where: { id: hunt.id }, data: { status: "done" } });
          throw new Refuse("He is already dead.");
        }
        if (!admin && target.currentCity !== hunt.foundCity) {
          await prisma.hunt.update({ where: { id: hunt.id }, data: { status: "lost" } });
          throw new Refuse("He has left the city. The trail is lost.");
        }
        const shotUser = await tx.user.findUnique({ where: { id: target.userId }, select: { isAdmin: true, staffRole: true } });
        if (isHiddenStaff(shotUser)) throw new Refuse("The trail has gone cold.");
        if (!admin && isShielded(target, now)) throw new Refuse("That player is under protection.");

        // How many bullets go into the one volley. They are spent whether he dies or not.
        const bulletsUsed = Math.floor(Number(body.bullets));
        if (!Number.isSafeInteger(bulletsUsed) || bulletsUsed < 1) throw new Refuse("Enter how many bullets to use.");
        if (!admin && bulletsUsed > me.bullets) throw new Refuse(`You only have ${me.bullets.toLocaleString("en-GB")} bullets.`);
        if (!admin) {
          const spent = await tx.player.updateMany({
            where: { id: me.id, bullets: { gte: bulletsUsed } },
            data: { bullets: { decrement: bulletsUsed } }
          });
          if (spent.count !== 1) throw new Refuse("You do not have that many bullets.");
        }

        // Let them heal first. The volley is judged against what it takes to kill him as he is now.
        const healed = regenHealth(target.health, target.healthAt, now.getTime());
        const needed = bulletsToKill(me.rankLevel, target.rankLevel, stats.firepower, target.protection, healed.health);
        const power = (bulletsUsed * rollLuck()) / needed;
        const killed = power >= 1;
        const damage = killed ? healed.health : Math.round(healed.health * power);
        const left = killed ? 0 : Math.max(1, healed.health - damage);

        await tx.player.update({
          where: { id: target.id },
          data: killed
            ? { health: 0, healthAt: null, diedAt: now, killedBy: me.username }
            : { health: left, healthAt: now }
        });
        // One chance only: a miss costs you the detective.
        await tx.hunt.update({
          where: { id: hunt.id },
          data: { status: killed ? "done" : "failed", shots: { increment: 1 } }
        });

        await tx.message.create({
          data: {
            toId: target.id,
            fromName: "The Evening Standard",
            subject: killed ? "You were shot dead" : "You were shot",
            body: killed
              ? `${userTag(me.username)} found you in ${hunt.foundCity} and shot you dead.`
              : `${userTag(me.username)} found you in ${hunt.foundCity} and shot at you, but you survived. Your health is down to ${left}%.`
          }
        });

        if (killed) {
          await cancelLedOc(tx, target.id, target.username);
          await dropCasinosOf(tx, target.id);
          await sendWitnessStatements(tx, {
            city: hunt.foundCity ?? target.currentCity,
            victimId: target.id,
            victimName: target.username,
            killer: { id: me.id, username: me.username }
          });
          await tx.hunt.updateMany({
            where: { targetId: target.id, status: { in: ["searching", "found"] } },
            data: { status: "lost" }
          });
          const newXp = me.experience + 100;
          const newLevel = Math.max(me.rankLevel, levelFromXp(newXp));
          await tx.player.update({
            where: { id: me.id },
            data: {
              kills: { increment: 1 },
              experience: newXp,
              rankLevel: newLevel,
              rank: rankForLevel(newLevel)
            }
          });
          await notifyPromotion(tx, me.id, me.rankLevel, newLevel);
          message = `${target.username} is dead. You shot him down in ${hunt.foundCity}.`;

          // Whoever kills him collects every bounty on his head.
          const prizes = await tx.bounty.findMany({
            where: { targetId: target.id, status: "active" }
          });
          const reward = prizes.reduce((n, b) => n + b.amount, 0);
          if (reward > 0) {
            await tx.bounty.updateMany({
              where: { targetId: target.id, status: "active" },
              data: { status: "paid", claimedBy: me.username, resolvedAt: now }
            });
            await tx.player.update({
              where: { id: me.id },
              data: { money: { increment: reward } }
            });
            message += ` The bounties on him paid £${reward.toLocaleString("en-GB")}.`;
          }
        } else {
          message = `You fired everything you put into it, but ${target.username} survived. The detective has gone, so you will have to hire again.`;
        }
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
    console.error("Whack failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
