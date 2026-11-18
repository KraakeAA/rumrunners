import { prisma } from "@/lib/prisma";
import { SHIELD_BREAK_WEALTH } from "@/lib/wealth";

export type DetectiveKey = "slow" | "medium" | "fast";

export const DETECTIVES: { key: DetectiveKey; name: string; note: string; price: number; minutes: number }[] = [
  { key: "slow", name: "Back-street Gumshoe", note: "Cheap and patient. Takes all day.", price: 100_000, minutes: 480 },
  { key: "medium", name: "Private Enquiry Agent", note: "A proper agency with a proper office.", price: 1_000_000, minutes: 120 },
  { key: "fast", name: "Yard Man, Off the Books", note: "A Scotland Yard inspector who moonlights. Finds anyone, fast.", price: 15_000_000, minutes: 15 }
];

// How long you have, after the detective reports, to reach the city and shoot.
export const WINDOW_MINUTES = 180;

// Health heals one point every three minutes.
export const HEALTH_REGEN_MS = 3 * 60_000;

// The one-week shield protects a player until they get too rich.
export function isShielded(
  p: { shieldUntil: Date | null; money: number; bank: number },
  now = new Date()
): boolean {
  return !!p.shieldUntil && p.shieldUntil > now && p.money + p.bank < SHIELD_BREAK_WEALTH;
}

export function regenHealth(health: number, healthAt: Date | null, now = Date.now()) {
  if (health <= 0 || health >= 100) return { health, healthAt: null as Date | null };
  const base = healthAt ? healthAt.getTime() : now;
  const points = Math.floor((now - base) / HEALTH_REGEN_MS);
  if (points <= 0) return { health, healthAt: healthAt ?? new Date(now) };
  const next = Math.min(100, health + points);
  return { health: next, healthAt: next >= 100 ? null : new Date(base + points * HEALTH_REGEN_MS) };
}

// Health taken by one volley: firepower, a bit of luck, less what protection soaks up.
export function rollDamage(firepower: number, protection: number, rng: () => number = Math.random) {
  const luck = 0.6 + rng() * 0.6;
  return Math.max(1, Math.round(firepower * luck * (1 - Math.min(100, protection) / 100)));
}

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(d);

// Turns finished searches into "found" and sends the letter. Safe to run any time.
export async function settleHunts(hunterId: string) {
  const now = new Date();

  const due = await prisma.hunt.findMany({
    where: { hunterId, status: "searching", foundAt: { lte: now } }
  });

  for (const h of due) {
    const target = await prisma.player.findUnique({
      where: { id: h.targetId },
      select: { currentCity: true, health: true, username: true }
    });

    if (!target || target.health <= 0) {
      const moved = await prisma.hunt.updateMany({ where: { id: h.id, status: "searching" }, data: { status: "lost" } });
      if (moved.count === 1) {
        await prisma.message.create({
          data: {
            toId: hunterId,
            fromName: "The Detective Agency",
            subject: "The trail has gone cold",
            body: `${h.targetName} can no longer be found. Your fee is not refunded.`
          }
        });
      }
      continue;
    }

    const endsAt = new Date(h.foundAt.getTime() + WINDOW_MINUTES * 60_000);
    const moved = await prisma.hunt.updateMany({
      where: { id: h.id, status: "searching" },
      data: { status: "found", foundCity: target.currentCity, windowEndsAt: endsAt }
    });
    if (moved.count === 1) {
      await prisma.message.create({
        data: {
          toId: hunterId,
          fromName: "The Detective Agency",
          subject: `${h.targetName} has been found`,
          body: `Our man has tracked ${h.targetName} to ${target.currentCity}. You have until ${when(endsAt)} to get to ${target.currentCity} and finish it. If they leave the city or the time runs out, you will have to hire again.`
        }
      });
    }
  }

  await prisma.hunt.updateMany({
    where: { hunterId, status: "found", windowEndsAt: { lte: now } },
    data: { status: "expired" }
  });
}
