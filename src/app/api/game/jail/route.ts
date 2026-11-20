import { agilityBonus, levelOf } from "@/lib/training";
import { denyIfDead } from "@/lib/alive";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { levelFromXp } from "@/lib/game";
import { rankForLevel } from "@/lib/ranks";
import {
  clamp,
  jailRemaining,
  sendToJail,
  sentenceFor
} from "@/lib/jail";
import { notifyPromotion } from "@/lib/promotion";

const BUST_MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

// The prison: who is inside, and how long you have left yourself.
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

  const inmates = await prisma.player.findMany({
    where: { jailUntil: { gt: now } },
    orderBy: [{ jailSecurity: "desc" }, { jailUntil: "desc" }],
    take: 60,
    select: {
      username: true,
      rank: true,
      jailReason: true,
      jailSecurity: true,
      jailUntil: true
    }
  });

  const milestones = await prisma.bustMilestone.findMany({
    where: { playerId: me.id },
    orderBy: { number: "asc" },
    take: 20
  });

  return NextResponse.json({
    bustStats: {
      wins: me.bustWins,
      fails: me.bustFails,
      streak: me.bustStreak,
      best: me.bustBest,
      worst: me.bustWorst,
      milestones: milestones.map((m) => ({
        number: m.number,
        freed: m.freed,
        date: m.createdAt.toISOString().slice(0, 10)
      }))
    },
    me: {
      remaining: jailRemaining(me.jailUntil, now),
      reason: me.jailReason,
      security: me.jailSecurity,
      selfBustUsed: me.selfBustUsed
    },
    inmates: inmates.map((i) => ({
      username: i.username,
      rank: i.rank,
      reason: i.jailReason ?? "Unknown",
      security: i.jailSecurity,
      remaining: jailRemaining(i.jailUntil, now)
    }))
  });
}

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { userId } });
      if (!me) throw new Error("PLAYER_NOT_FOUND");

      const now = new Date();
      const myLeft = jailRemaining(me.jailUntil, now);

      // ----- Breaking yourself out: once per sentence. -----
      if (action === "self") {
        if (myLeft <= 0) throw new Error("NOT_JAILED");
        if (me.selfBustUsed) throw new Error("SELF_USED");

        const chance = clamp(0.35 - (me.jailSecurity - 1) * 0.06, 0.1, 0.35) + agilityBonus(levelOf(me.agilityPts));
        const success = Math.random() < chance;

        if (success) {
          await tx.player.update({
            where: { id: me.id },
            data: { jailUntil: null, jailReason: null, selfBustUsed: true }
          });
          return {
            success: true,
            message: "You slipped the guards and got out over the wall. You're free."
          };
        }

        // A failed escape adds time: half of what's left, at least 5 seconds.
        // Sentences grow with rank and job size, so the penalty does too.
        const extra = Math.max(5, Math.round(myLeft * 0.5));
        await tx.player.update({
          where: { id: me.id },
          data: {
            jailUntil: new Date(me.jailUntil!.getTime() + extra * 1000),
            selfBustUsed: true
          }
        });
        return {
          success: false,
          message: `The guards caught you. ${extra >= 60 ? Math.ceil(extra / 60) + " minutes" : extra + " seconds"} were added to your sentence, and you won't get another try.`
        };
      }

      // ----- Breaking someone else out. -----
      if (action === "bust") {
        if (myLeft > 0) throw new Error("YOU_JAILED");

        const username =
          typeof body.username === "string" ? body.username : "";
        const target = await tx.player.findUnique({ where: { username } });
        if (!target) throw new Error("NO_TARGET");
        if (target.id === me.id) throw new Error("NO_TARGET");
        if (jailRemaining(target.jailUntil, now) <= 0) throw new Error("ALREADY_FREE");

        const security = target.jailSecurity;
        const chance = clamp(0.7 - (security - 1) * 0.12, 0.2, 0.7) + agilityBonus(levelOf(me.agilityPts));
        const success = Math.random() < chance;

        if (success) {
          // Only one buster can free a given prisoner.
          const freed = await tx.player.updateMany({
            where: { id: target.id, jailUntil: { gt: now } },
            data: { jailUntil: null, jailReason: null }
          });
          if (freed.count === 0) throw new Error("ALREADY_FREE");

          const xp = 4 + security * 4;
          const newXp = me.experience + xp;
          const newLevel = Math.max(me.rankLevel, levelFromXp(newXp));
          const streak = me.bustStreak > 0 ? me.bustStreak + 1 : 1;
          const wins = me.bustWins + 1;
          await tx.player.update({
            where: { id: me.id },
            data: {
              experience: newXp,
              rankLevel: newLevel,
              rank: rankForLevel(newLevel),
              bustWins: wins,
              bustStreak: streak,
              bustBest: Math.max(me.bustBest, streak)
            }
          });
          if (BUST_MILESTONES.includes(wins)) {
            await tx.bustMilestone.create({
              data: { playerId: me.id, number: wins, freed: target.username }
            });
          }
          await notifyPromotion(tx, me.id, me.rankLevel, newLevel);
          return {
            success: true,
            message: `You got ${target.username} out. +${xp} XP.`
          };
        }

        // Caught: the would-be rescuer ends up inside. The cell time grows
        // with the prison's security and the rescuer's own rank.
        const failStreak = me.bustStreak < 0 ? me.bustStreak - 1 : -1;
        await tx.player.update({
          where: { id: me.id },
          data: {
            bustFails: { increment: 1 },
            bustStreak: failStreak,
            bustWorst: Math.min(me.bustWorst, failStreak)
          }
        });
        const penalty = sentenceFor(security, me.rankLevel).seconds;
        await sendToJail(
          tx,
          me.id,
          penalty,
          security,
          `Caught trying to bust out ${target.username}`,
          now
        );
        return {
          success: false,
          message: `The guards were waiting. You've been locked up for ${penalty >= 60 ? Math.ceil(penalty / 60) + " minutes" : penalty + " seconds"}.`
        };
      }

      throw new Error("BAD_ACTION");
    });

    return NextResponse.json(result);
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      NOT_JAILED: ["You're not in jail.", 400],
      SELF_USED: ["You've already tried to break out of this sentence.", 400],
      YOU_JAILED: ["You can't bust anyone out while you're locked up yourself.", 403],
      NO_TARGET: ["Nobody by that name to bust out.", 404],
      ALREADY_FREE: ["That prisoner has already gone free.", 400],
      BAD_ACTION: ["Unknown action.", 400],
      PLAYER_NOT_FOUND: ["Player not found.", 404]
    };
    if (map[m]) {
      return NextResponse.json({ error: map[m][0] }, { status: map[m][1] });
    }
    console.error("Jail action failed:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
