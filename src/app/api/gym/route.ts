import { NextResponse } from "next/server";
import { lockPlayer } from "@/lib/lock";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { denyIfDead } from "@/lib/alive";
import { jailRemaining } from "@/lib/jail";
import { energyAfterRegen, maxEnergyFor } from "@/lib/game";
import { GUNS } from "@/lib/store";
import {
  MAX_LEVEL,
  SESSIONS,
  SESSION_NAMES,
  STATS,
  agilityBonus,
  pointsKey,
  progress,
  staminaDiscount,
  type StatKey
} from "@/lib/training";

class Refuse extends Error {}

type PointsRow = { strengthPts: number; staminaPts: number; agilityPts: number };

function statsView(p: PointsRow) {
  return STATS.map((s) => {
    const pr = progress(p[pointsKey(s.key)]);
    return {
      key: s.key,
      label: s.label,
      blurb: s.blurb,
      level: pr.level,
      into: pr.into,
      needed: pr.needed,
      maxed: pr.maxed,
      sessions: SESSIONS.map((x) => ({ key: x.key, name: SESSION_NAMES[s.key][x.key], energy: x.energy, xp: x.xp }))
    };
  });
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const me = await prisma.player.findUnique({ where: { userId } });
  if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  const strength = progress(me.strengthPts).level;
  const stamina = progress(me.staminaPts).level;
  const agility = progress(me.agilityPts).level;

  return NextResponse.json({
    jailed: jailRemaining(me.jailUntil) > 0,
    maxLevel: MAX_LEVEL,
    stats: statsView(me),
    perks: {
      energySaved: Math.round(staminaDiscount(stamina) * 100),
      jailBonus: Math.round(agilityBonus(agility) * 100)
    },
    guns: GUNS.map((g) => ({
      name: g.name,
      strength: g.strength ?? 0,
      unlocked: strength >= (g.strength ?? 0)
    }))
  });
}

export async function POST(req: Request) {
  const dead = await denyIfDead();
  if (dead) return dead;

  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const stat = String(body.stat ?? "") as StatKey;
    const session = SESSIONS.find((x) => x.key === String(body.session ?? ""));
    if (!STATS.some((s) => s.key === stat)) return NextResponse.json({ error: "Choose what to train." }, { status: 400 });
    if (!session) return NextResponse.json({ error: "Choose a training session." }, { status: 400 });

    const key = pointsKey(stat);

    const result = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const me = await tx.player.findUnique({ where: { userId } });
      if (!me) throw new Refuse("Player not found.");
      if (jailRemaining(me.jailUntil) > 0) throw new Refuse("There is no gymnasium in a prison cell.");

      const now = new Date();
      const maxEnergy = maxEnergyFor(me.rankLevel);
      const regen = energyAfterRegen(me.energy, maxEnergy, me.lastEnergyAt, now);
      const energyCost = session.energy;

      if (progress(me[key]).maxed) throw new Refuse("You've reached the top level in that. There's nothing more to learn.");
      if (regen.energy < energyCost) throw new Refuse("You're too tired for that session.");

      const updated = await tx.player.update({
        where: { id: me.id },
        data: {
          energy: regen.energy - energyCost,
          // A full tank has no running clock, so start one when energy is spent.
          lastEnergyAt: regen.energy >= maxEnergy ? now : regen.lastEnergyAt,
          ...(stat === "strength" ? { strengthPts: { increment: session.xp } } : {}),
          ...(stat === "stamina" ? { staminaPts: { increment: session.xp } } : {}),
          ...(stat === "agility" ? { agilityPts: { increment: session.xp } } : {})
        }
      });

      const before = progress(me[key]).level;
      const after = progress(updated[key]).level;
      return { updated, before, after };
    });

    const label = STATS.find((s) => s.key === stat)!.label;
    const gained = result.after > result.before;

    return NextResponse.json({
      ok: true,
      message: gained
        ? `${label} is now level ${result.after}.`
        : `+${session.xp} ${label.toLowerCase()} xp.`,
      energy: result.updated.energy,
      levels: {
        strength: progress(result.updated.strengthPts).level,
        stamina: progress(result.updated.staminaPts).level,
        agility: progress(result.updated.agilityPts).level
      }
    });
  } catch (error) {
    if (error instanceof Refuse) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Gym failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
