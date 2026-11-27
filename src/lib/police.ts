import type { Prisma } from "@prisma/client";
import { isAdminUser } from "@/lib/admin-bypass";
import { jailRemaining, sendToJail, sentenceFor } from "@/lib/jail";
import {
  carModel,
  currentHeat,
  EXPOSURE_MINUTES,
  HEAT_RULES_FROM,
  MAX_SWEEPS,
  SWEEP_MINUTES,
  sweepChance
} from "@/lib/era";

type Db = Prisma.TransactionClient;

// Police checks on a player's cars, worked out when they next look. Call it
// inside a transaction after lockPlayer. Returns a line for each car found.
//  - A car still on its stolen plates, in the city it was stolen in, is found
//    once 5 minutes have passed.
//  - Otherwise every 2 hours there is a chance by heat zone (none on green,
//    amber higher, red highest; half as likely once shipped).
// A car that is found is taken away and the owner is arrested.
export async function policeSweep(tx: Db, userId: string, now = new Date()): Promise<string[]> {
  const player = await tx.player.findUnique({
    where: { userId },
    select: { id: true, rankLevel: true, jailUntil: true }
  });
  if (!player) return [];

  const cars = await tx.car.findMany({ where: { ownerId: player.id, escrowId: null } });
  if (cars.length === 0) return [];

  const admin = await isAdminUser(userId, tx);
  const t = now.getTime();
  const step = SWEEP_MINUTES * 60_000;
  const notices: string[] = [];
  let jailed = jailRemaining(player.jailUntil, now) > 0;

  for (const car of cars) {
    if (!car.sweptAt) {
      await tx.car.update({ where: { id: car.id }, data: { sweptAt: now } });
      continue;
    }

    const model = carModel(car.model);
    const name = model?.name ?? "stolen car";
    const shipped = car.city !== car.originCity;
    let found = "";

    const exposed =
      !car.plateChanged &&
      !shipped &&
      car.createdAt.getTime() >= HEAT_RULES_FROM &&
      t - car.createdAt.getTime() > EXPOSURE_MINUTES * 60_000;

    if (exposed) {
      found = `Police spotted your ${name} [${car.plate}] still wearing its stolen plates.`;
    } else {
      const sweeps = Math.min(MAX_SWEEPS, Math.floor((t - car.sweptAt.getTime()) / step));
      for (let i = 1; i <= sweeps && !found; i++) {
        const at = car.sweptAt.getTime() + i * step;
        const heat = currentHeat(car.heat, car.heatAt, at);
        if (Math.random() < sweepChance(heat, shipped)) {
          found = `A patrol found your ${name} [${car.plate}] in ${car.city}.`;
        }
      }
      if (!found && sweeps > 0) {
        await tx.car.update({
          where: { id: car.id },
          data: { sweptAt: new Date(Math.max(car.sweptAt.getTime() + sweeps * step, t - step)) }
        });
      }
    }

    if (!found) continue;

    await tx.car.delete({ where: { id: car.id } });
    if (!admin && !jailed) {
      const sentence = sentenceFor((model?.tier ?? 1) + 1, player.rankLevel);
      await sendToJail(tx, player.id, sentence.seconds, sentence.security, `Caught with a stolen ${name}`, now);
      jailed = true;
      notices.push(`${found} The car was impounded and you were arrested.`);
    } else {
      notices.push(`${found} The car was impounded.`);
    }
  }

  return notices;
}
