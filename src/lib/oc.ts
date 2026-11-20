import type { Prisma } from "@prisma/client";
// Organised crime: pure data, safe for server and browser.

export const OC_START_COST = 5; // £ the leader pays to start a crew

export type OcRole = "weapons" | "explosives" | "driver";

export const OC_ROLES: { key: OcRole; name: string }[] = [
  { key: "weapons", name: "Weapons Expert" },
  { key: "explosives", name: "Explosive Expert" },
  { key: "driver", name: "Driver" }
];

export function roleName(key: string): string {
  return OC_ROLES.find((r) => r.key === key)?.name ?? key;
}

export type OcChoice = "cheap" | "middle" | "high";

export const OC_CHOICES: OcChoice[] = ["cheap", "middle", "high"];

// What each expert can bring. The driver's choice comes from the car instead.
export const OC_ITEMS: Record<"weapons" | "explosives", Record<OcChoice, string>> = {
  weapons: {
    cheap: "Old service revolvers",
    middle: "Sawn-off shotguns",
    high: "Thompson submachine guns"
  },
  explosives: {
    cheap: "Quarry blasting powder",
    middle: "Gelignite and fuse",
    high: "Nitroglycerine charges"
  }
};

// A driver's car decides the level: cheap runabouts, middling saloons, or the grand cars.
export function choiceForCarTier(tier: number): OcChoice {
  if (tier >= 4) return "high";
  if (tier >= 2) return "middle";
  return "cheap";
}

// ---- The vault ----
// A job pays a random vault. The gear the crew brought changes how big it is,
// and now and then the take is boosted by a lucky break.
export const VAULT_MIN = 80;
export const VAULT_MAX = 160;

export const GEAR_MULTIPLIER: Record<"weapons" | "explosives" | "driver", Record<OcChoice, number>> = {
  weapons: { cheap: 0.9, middle: 1, high: 1.15 },
  explosives: { cheap: 0.85, middle: 1, high: 1.3 },
  driver: { cheap: 0.95, middle: 1, high: 1.2 }
};

export function rollVault(
  gear: { weapons: OcChoice; explosives: OcChoice; driver: OcChoice },
  rng: () => number = Math.random
): { vault: number; boost: number; boostNote: string } {
  const base = VAULT_MIN + rng() * (VAULT_MAX - VAULT_MIN);
  const equipment =
    GEAR_MULTIPLIER.weapons[gear.weapons] *
    GEAR_MULTIPLIER.explosives[gear.explosives] *
    GEAR_MULTIPLIER.driver[gear.driver];

  const roll = rng();
  const boost = roll < 0.05 ? 3 : roll < 0.2 ? 1.5 : 1;
  const boostNote =
    boost === 3
      ? "The vault was packed to the roof. Triple the usual take."
      : boost === 1.5
        ? "The vault held more than anyone expected. Half as much again."
        : "";

  return {
    vault: Math.max(5, Math.round((base * equipment * boost) / 5) * 5),
    boost,
    boostNote
  };
}

// When a player dies: if they led a crew it is called off and everyone in it is told; if they were
// a member (or had been invited) their seat is freed so the crew isn't left waiting on a dead man.
export async function cancelLedOc(
  tx: Pick<Prisma.TransactionClient, "organisedCrime" | "ocSlot" | "message">,
  playerId: string,
  playerName: string
) {
  const led = await tx.organisedCrime.findUnique({
    where: { leaderId: playerId },
    include: { slots: true }
  });
  if (led) {
    for (const s of led.slots) {
      if (!s.playerId) continue;
      await tx.message.create({
        data: {
          toId: s.playerId,
          fromName: playerName,
          subject: "Crew cancelled",
          body: `${playerName} died, so the organised crime in ${led.city} has been cancelled.`
        }
      });
    }
    await tx.organisedCrime.delete({ where: { id: led.id } });
  }

  const seats = await tx.ocSlot.findMany({
    where: { playerId },
    include: { oc: { select: { leaderId: true, city: true } } }
  });
  for (const seat of seats) {
    await tx.ocSlot.update({
      where: { id: seat.id },
      data: { state: "empty", playerId: null, percent: null, choice: null, carId: null }
    });
    if (seat.state !== "invited") {
      await tx.message.create({
        data: {
          toId: seat.oc.leaderId,
          fromName: playerName,
          subject: "Crew member died",
          body: `${playerName} has died. The ${seat.role} position in your ${seat.oc.city} crew is open again.`
        }
      });
    }
  }
}
