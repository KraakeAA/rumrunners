import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { rankForLevel } from "@/lib/ranks";
import { xpForLevel } from "@/lib/game";
import { CARS, carModel, makePlate, SHIP_CITIES } from "@/lib/era";
import { staffLevel } from "@/lib/staff";
import { OPENING_WINDOW_MS } from "@/lib/venues";

class Refuse extends Error {}

const FIELDS = ["money", "bank", "gold", "bullets"] as const;
const MAX_VALUE = 2_000_000_000;

// Moderators (level 2) can look players up and use the safe tools; the rest is for admins (level 3).
async function requireStaff(min: number) {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, staffRole: true, player: { select: { id: true, username: true } } }
  });
  if (!user?.player || staffLevel(user) < min) return null;
  return user.player;
}

const MOD_ACTIONS = ["ban", "unban", "revive", "release", "letter"];

async function profile(username: string) {
  const p = await prisma.player.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      rank: true,
      rankLevel: true,
      money: true,
      bank: true,
      gold: true,
      bullets: true,
      health: true,
      jailUntil: true,
      currentCity: true,
      crew: { select: { name: true } },
      user: { select: { email: true, isAdmin: true, staffRole: true, banned: true, banReason: true } },
      cars: { select: { id: true, model: true, plate: true, city: true, escrowId: true }, orderBy: { createdAt: "asc" } },
      ownedCasinos: { select: { id: true, city: true, game: true } },
      ownedBulletFactories: { select: { id: true, city: true } }
    }
  });
  if (!p) return null;
  return {
    id: p.id,
    username: p.username,
    email: p.user.email,
    isAdmin: p.user.isAdmin,
    staffRole: p.user.staffRole ?? "",
    banned: p.user.banned,
    banReason: p.user.banReason ?? "",
    rank: p.rank,
    rankLevel: p.rankLevel,
    money: p.money,
    bank: p.bank,
    gold: p.gold,
    bullets: p.bullets,
    health: p.health,
    jailed: p.jailUntil ? p.jailUntil.getTime() > Date.now() : false,
    city: p.currentCity,
    crew: p.crew?.name ?? "",
    cars: p.cars.map((c) => ({
      id: c.id,
      name: carModel(c.model)?.name ?? c.model,
      plate: c.plate,
      city: c.city,
      held: Boolean(c.escrowId)
    })),
    casinos: p.ownedCasinos,
    factories: p.ownedBulletFactories
  };
}

export async function GET(req: Request) {
  try {
    const admin = await requireStaff(2);
    if (!admin) return NextResponse.json({ error: "Staff only." }, { status: 403 });

    const url = new URL(req.url);
    const username = url.searchParams.get("username");

    if (username !== null) {
      const found = await profile(username.trim());
      if (!found) return NextResponse.json({ error: "No player with that name." }, { status: 404 });
      return NextResponse.json({ player: found });
    }

    // Everything that can be handed out: admins only.
    if (!(await requireStaff(3))) return NextResponse.json({ cars: [], cities: [], casinos: [], factories: [] });
    const [casinos, factories] = await Promise.all([
      prisma.casino.findMany({
        orderBy: [{ city: "asc" }, { game: "asc" }],
        select: { id: true, city: true, game: true, owner: { select: { username: true } } }
      }),
      prisma.bulletFactory.findMany({
        orderBy: { city: "asc" },
        select: { id: true, city: true, owner: { select: { username: true } } }
      })
    ]);
    return NextResponse.json({
      cars: CARS.map((c) => ({ key: c.key, name: c.name })),
      cities: SHIP_CITIES,
      casinos: casinos.map((c) => ({ id: c.id, label: `${c.game} in ${c.city}`, owner: c.owner?.username ?? "" })),
      factories: factories.map((f) => ({ id: f.id, label: `Bullet factory in ${f.city}`, owner: f.owner?.username ?? "" }))
    });
  } catch (error) {
    console.error("Admin load failed:", error);
    return NextResponse.json({ error: "That could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const admin = await requireStaff(MOD_ACTIONS.includes(action) ? 2 : 3);
    if (!admin) return NextResponse.json({ error: "You don't have access to that." }, { status: 403 });
    const username = String(body.username ?? "").trim();

    const target = await prisma.player.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true, userId: true, rankLevel: true, user: { select: { isAdmin: true, staffRole: true } } }
    });
    if (!target) return NextResponse.json({ error: "No player with that name." }, { status: 404 });

    let message = "";

    if (action === "ban") {
      if (target.id === admin.id) throw new Refuse("You can't ban yourself.");
      if (target.user.isAdmin) throw new Refuse("You can't ban another admin.");
      if (target.user.staffRole === "MODERATOR" && !(await requireStaff(3))) throw new Refuse("Only an admin can ban a moderator.");
      const reason = String(body.reason ?? "").trim().slice(0, 200);
      await prisma.user.update({
        where: { id: target.userId },
        data: { banned: true, banReason: reason || null, bannedAt: new Date() }
      });
      message = `${target.username} is banned.`;
    } else if (action === "unban") {
      await prisma.user.update({
        where: { id: target.userId },
        data: { banned: false, banReason: null, bannedAt: null }
      });
      message = `${target.username} is unbanned.`;
    } else if (action === "setstaff") {
      const role = String(body.role ?? "");
      if (!["none", "helper", "moderator", "admin"].includes(role)) throw new Refuse("Pick a role.");
      if (target.id === admin.id) throw new Refuse("You can't change your own role.");
      await prisma.user.update({
        where: { id: target.userId },
        data: {
          isAdmin: role === "admin",
          staffRole: role === "helper" ? "HELPER" : role === "moderator" ? "MODERATOR" : null
        }
      });
      message = role === "none" ? `${target.username} is now an ordinary player.` : `${target.username} is now ${role === "admin" ? "an admin" : `a ${role}`}.`;
    } else if (action === "adjust") {
      const field = String(body.field ?? "");
      if (!(FIELDS as readonly string[]).includes(field)) throw new Refuse("Pick money, bank, gold or bullets.");
      const amount = Number(body.amount);
      if (!Number.isSafeInteger(amount)) throw new Refuse("Enter a whole number.");
      const mode = body.mode === "set" ? "set" : "add";
      await prisma.$transaction(async (tx) => {
        const row = await tx.player.findUnique({ where: { id: target.id }, select: { [field]: true } });
        if (!row) throw new Refuse("No player with that name.");
        const current = (row as unknown as Record<string, number>)[field];
        const next = Math.max(0, Math.min(MAX_VALUE, mode === "set" ? amount : current + amount));
        await tx.player.update({ where: { id: target.id }, data: { [field]: next } });
        message = `${target.username}'s ${field} is now ${next.toLocaleString("en-GB")}.`;
      });
    } else if (action === "setrank") {
      const level = Number(body.level);
      if (!Number.isSafeInteger(level) || level < 1 || level > 100) throw new Refuse("Enter a rank level from 1 to 100.");
      await prisma.player.update({
        where: { id: target.id },
        data: { rankLevel: level, rank: rankForLevel(level), experience: xpForLevel(level) }
      });
      if (level > target.rankLevel) {
        await prisma.message.create({
          data: {
            toId: target.id,
            fromName: "The Underworld",
            subject: "You were promoted",
            body: `You were promoted to ${rankForLevel(level)}. Harder jobs and bigger rewards are open to you now, and your energy tank has grown.`
          }
        });
      }
      message = `${target.username} is now ${rankForLevel(level)} (level ${level}).`;
    } else if (action === "revive") {
      await prisma.player.update({
        where: { id: target.id },
        data: { health: 100, healthAt: null, diedAt: null, killedBy: null }
      });
      message = `${target.username} is back on their feet.`;
    } else if (action === "release") {
      await prisma.player.update({ where: { id: target.id }, data: { jailUntil: null, jailReason: null } });
      message = `${target.username} is out of jail.`;
    } else if (action === "givecar") {
      const model = carModel(String(body.model ?? ""));
      if (!model) throw new Refuse("Pick a car.");
      const city = SHIP_CITIES.includes(String(body.city)) ? String(body.city) : "London";
      await prisma.car.create({
        data: { ownerId: target.id, model: model.key, originCity: city, city, plate: makePlate(city) }
      });
      message = `${target.username} was given a ${model.name}.`;
    } else if (action === "removecar") {
      const removed = await prisma.car.deleteMany({ where: { id: String(body.carId ?? ""), ownerId: target.id } });
      if (removed.count !== 1) throw new Refuse("That car isn't theirs.");
      message = `The car was taken from ${target.username}.`;
    } else if (action === "giveproperty") {
      const id = String(body.propertyId ?? "");
      if (body.kind === "casino") {
        const before = await prisma.casino.findUnique({ where: { id }, select: { ownerId: true, chips: true } });
        const done = await prisma.casino.updateMany({
          where: { id },
          data: { ownerId: target.id, ownedSince: new Date(), chips: 0, openAt: new Date(Date.now() + OPENING_WINDOW_MS) }
        });
        if (done.count !== 1) throw new Refuse("That casino no longer exists.");
        // Chips left by the previous owner go back to them as cash.
        if (before?.ownerId && before.chips > 0) {
          await prisma.player.update({ where: { id: before.ownerId }, data: { money: { increment: before.chips } } });
        }
      } else if (body.kind === "factory") {
        const done = await prisma.bulletFactory.updateMany({ where: { id }, data: { ownerId: target.id } });
        if (done.count !== 1) throw new Refuse("That factory no longer exists.");
      } else {
        throw new Refuse("Pick a casino or a factory.");
      }
      message = `${target.username} now owns it.`;
    } else if (action === "removeproperty") {
      const id = String(body.propertyId ?? "");
      if (body.kind === "casino") {
        const held = await prisma.casino.findUnique({ where: { id }, select: { chips: true, ownerId: true } });
        const freed = await prisma.casino.updateMany({
          where: { id, ownerId: target.id },
          data: { ownerId: null, ownedSince: null, chips: 0, openAt: null }
        });
        if (freed.count === 1 && held && held.chips > 0) {
          await prisma.player.update({ where: { id: target.id }, data: { money: { increment: held.chips } } });
        }
      } else if (body.kind === "factory") {
        await prisma.bulletFactory.updateMany({ where: { id, ownerId: target.id }, data: { ownerId: null } });
      } else {
        throw new Refuse("Pick a casino or a factory.");
      }
      message = `It was taken from ${target.username} and handed back to the house.`;
    } else if (action === "letter") {
      const subject = String(body.subject ?? "").trim().slice(0, 100);
      const text = String(body.text ?? "").trim().slice(0, 5000);
      if (!subject || !text) throw new Refuse("Write a subject and a message.");
      await prisma.message.create({ data: { toId: target.id, fromName: admin.username, subject, body: text } });
      message = `Letter sent to ${target.username}.`;
    } else {
      throw new Refuse("Unknown action.");
    }

    return NextResponse.json({ ok: true, message, player: await profile(target.username) });
  } catch (error) {
    if (error instanceof Refuse) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Admin action failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
