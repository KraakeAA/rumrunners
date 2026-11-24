import { prisma } from "@/lib/prisma";
import { userTag } from "@/lib/mailtext";
import { SHIELD_BREAK_WEALTH } from "@/lib/wealth";

export type DetectiveKey = "slow" | "medium" | "fast";

// A detective reports at a random moment between minMinutes and maxMinutes after he is hired.
// Once he reports, the hunter has windowMinutes to reach the city and take the one shot.
// The dearest detective reports fastest but leaves only a short window: an emergency job.
export const DETECTIVES: {
  key: DetectiveKey;
  name: string;
  note: string;
  price: number;
  minMinutes: number;
  maxMinutes: number;
  windowMinutes: number;
}[] = [
  { key: "slow", name: "Back-street Gumshoe", note: "Cheap and patient. Could take most of a day.", price: 100_000, minMinutes: 360, maxMinutes: 480, windowMinutes: 60 },
  { key: "medium", name: "Private Enquiry Agent", note: "A proper agency with a proper office.", price: 1_000_000, minMinutes: 60, maxMinutes: 120, windowMinutes: 30 },
  { key: "fast", name: "Yard Man, Off the Books", note: "A Scotland Yard inspector who moonlights. Finds anyone, fast, but you must move at once.", price: 15_000_000, minMinutes: 10, maxMinutes: 20, windowMinutes: 5 }
];

export function windowMinutesFor(tier: string): number {
  return DETECTIVES.find((d) => d.key === tier)?.windowMinutes ?? 30;
}

// A random moment for the detective to report, anywhere inside his range.
export function rollFindMinutes(d: { minMinutes: number; maxMinutes: number }, rng: () => number = Math.random) {
  return d.minMinutes + rng() * (d.maxMinutes - d.minMinutes);
}

// Bullets it takes to kill a target on full health. One volley, one chance.
// Every rank the target has climbed multiplies the cost, and every rank a shooter is below his
// target multiplies it again, so a Scum going for the top man needs about a million bullets.
// A bigger gun and a lower-armoured target both bring it down.
//   Scum, Webley v Scum: 100 · Scum, Webley v Legendary Crime Baron, no armour: 1,000,000
//   Gangster, Tommy gun v Gangster, 40% armour: about 1,200 · Legendary, Tommy gun v Legendary, 75% armour: about 16,000
export const BULLET_BASE = 100;
const RANK_GROWTH = 1.5; // per rank of the target
const GAP_GROWTH = 1.436; // per rank the shooter is below the target
export function bulletsForFullHealth(shooterRank: number, targetRank: number, firepower: number, protection: number): number {
  const rank = Math.pow(RANK_GROWTH, Math.max(1, targetRank) - 1);
  const gap = targetRank > shooterRank ? Math.pow(GAP_GROWTH, targetRank - shooterRank) : Math.max(0.4, Math.pow(0.95, shooterRank - targetRank));
  const gun = Math.sqrt(Math.max(firepower, 1) / 5);
  const armour = 1 - Math.min(90, Math.max(0, protection)) / 100;
  return Math.max(1, Math.ceil((BULLET_BASE * rank * gap) / gun / armour));
}

// Bullets to finish a target on the health he has now (health is a percentage).
export function bulletsToKill(
  shooterRank: number,
  targetRank: number,
  firepower: number,
  protection: number,
  targetHealth: number
): number {
  const full = bulletsForFullHealth(shooterRank, targetRank, firepower, protection);
  return Math.max(1, Math.ceil((full * Math.max(1, Math.min(100, targetHealth))) / 100));
}

// The volley is never exact: a bad day is 15% weaker, a good day 15% stronger.
export const LUCK_SPREAD = 0.15;
export function rollLuck(rng: () => number = Math.random) {
  return 1 - LUCK_SPREAD + rng() * LUCK_SPREAD * 2;
}

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
            body: `${userTag(h.targetName)} can no longer be found. Your fee is not refunded.`
          }
        });
      }
      continue;
    }

    const endsAt = new Date(h.foundAt.getTime() + windowMinutesFor(h.tier) * 60_000);
    const moved = await prisma.hunt.updateMany({
      where: { id: h.id, status: "searching" },
      data: { status: "found", foundCity: target.currentCity, windowEndsAt: endsAt }
    });
    if (moved.count === 1) {
      await prisma.message.create({
        data: {
          toId: hunterId,
          fromName: "The Detective Agency",
          subject: `${userTag(h.targetName)} has been found`,
          body: `Our man has tracked ${userTag(h.targetName)} to ${target.currentCity}. You have until ${when(endsAt)} (${windowMinutesFor(h.tier)} minutes) to get to ${target.currentCity} and take your one shot. If they leave the city or the time runs out, you will have to hire again.`
        }
      });
    }
  }

  await prisma.hunt.updateMany({
    where: { hunterId, status: "found", windowEndsAt: { lte: now } },
    data: { status: "expired" }
  });
}
