// Server-side logic for player-owned casinos and bullet factories.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CASINO_GAMES,
  CITIES,
  FACTORY,
  HOUSE_MAX_BET,
  HOUSE_ONLY_GAMES,
  casinoDef,
  houseMaxBet,
  isHouseOnly,
  wealthLabel,
  type CasinoView,
  type FactoryView,
  type VenueData
} from "@/lib/venues";

type Tx = Prisma.TransactionClient;

// Makes sure every city has a row for each casino game and a bullet factory.
export async function ensureVenues() {
  const casinoRows = CITIES.flatMap((city) =>
    CASINO_GAMES.map((g) => ({ city, game: g.key, maxBet: houseMaxBet(g.key) }))
  );
  await prisma.casino.createMany({ data: casinoRows, skipDuplicates: true });
  // War is never player-owned: release any that were bought before this rule.
  await prisma.casino.updateMany({
    where: { game: { in: HOUSE_ONLY_GAMES }, ownerId: { not: null }, escrowId: null },
    data: { ownerId: null }
  });
  await prisma.bulletFactory.createMany({
    data: CITIES.map((city) => ({ city, pricePerBullet: FACTORY.defaultPrice })),
    skipDuplicates: true
  });
}

// Catches a factory up on the batches it should have made since the last visit.
// Every batch costs the owner steel from their cash on hand. If they cannot
// pay, the factory is lost and goes back on the market.
export async function settleFactory(tx: Tx, city: string, now = new Date()) {
  const factory = await tx.bulletFactory.findUnique({ where: { city } });
  if (!factory || !factory.ownerId) return factory;

  const elapsed = now.getTime() - factory.lastProducedAt.getTime();
  const due = Math.min(
    Math.floor(elapsed / FACTORY.intervalMs),
    FACTORY.maxCatchUpRuns
  );
  if (due < 1) return factory;

  let made = 0;
  let lost = false;
  for (let i = 0; i < due; i++) {
    const paid = await tx.player.updateMany({
      where: { id: factory.ownerId, money: { gte: FACTORY.steelCost } },
      data: { money: { decrement: FACTORY.steelCost } }
    });
    if (paid.count !== 1) {
      lost = true;
      break;
    }
    made++;
  }

  const lastProducedAt = lost
    ? now
    : new Date(factory.lastProducedAt.getTime() + due * FACTORY.intervalMs);

  return tx.bulletFactory.update({
    where: { city },
    data: {
      stock: { increment: made * FACTORY.batchSize },
      totalProduced: { increment: made * FACTORY.batchSize },
      lastProducedAt,
      ...(lost ? { ownerId: null } : {})
    }
  });
}

export async function loadVenueData(playerId: string): Promise<VenueData | null> {
  await ensureVenues();

  for (const city of CITIES) {
    await prisma.$transaction((tx) => settleFactory(tx, city));
  }

  const me = await prisma.player.findUnique({
    where: { id: playerId },
    select: { money: true, bullets: true, currentCity: true }
  });
  if (!me) return null;

  const [casinos, factories] = await Promise.all([
    prisma.casino.findMany({
      include: { owner: { select: { id: true, money: true, username: true } } }
    }),
    prisma.bulletFactory.findMany({
      include: { owner: { select: { id: true, money: true, username: true } } }
    })
  ]);

  const cityOrder = (c: string) => CITIES.indexOf(c);
  const gameOrder = (g: string) => CASINO_GAMES.findIndex((x) => x.key === g);

  const casinoViews: CasinoView[] = casinos
    .sort((a, b) => cityOrder(a.city) - cityOrder(b.city) || gameOrder(a.game) - gameOrder(b.game))
    .map((c) => {
      const def = casinoDef(c.game);
      const houseOnly = isHouseOnly(c.game);
      const mine = !houseOnly && c.ownerId === playerId;
      return {
        id: c.id,
        city: c.city,
        game: c.game,
        label: def.label,
        ownerId: houseOnly ? null : c.ownerId,
        ownerName: houseOnly ? null : c.owner?.username ?? null,
        // A casino's wealth is its chips, not the owner's cash.
        ownerWealth: !houseOnly && c.owner ? wealthLabel(c.chips) : null,
        openAt: c.openAt && c.openAt.getTime() > Date.now() ? c.openAt.toISOString() : null,
        maxBet: houseOnly ? houseMaxBet(c.game) : c.ownerId ? c.maxBet : HOUSE_MAX_BET,
        price: def.price,
        topMultiplier: def.topMultiplier,
        isMine: mine,
        ...(mine
          ? { chips: c.chips, profit: c.profit, plays: c.plays, wagered: c.wagered, ownerCash: c.owner?.money ?? 0 }
          : {})
      };
    });

  const factoryViews: FactoryView[] = factories
    .sort((a, b) => cityOrder(a.city) - cityOrder(b.city))
    .map((f) => {
      const mine = f.ownerId === playerId;
      return {
        id: f.id,
        city: f.city,
        ownerId: f.ownerId,
        ownerName: f.owner?.username ?? null,
        ownerWealth: f.owner ? wealthLabel(f.owner.money) : null,
        stock: f.stock,
        pricePerBullet: f.pricePerBullet,
        price: FACTORY.price,
        steelCost: FACTORY.steelCost,
        batchSize: FACTORY.batchSize,
        intervalMs: FACTORY.intervalMs,
        isMine: mine,
        nextRunAt: f.ownerId
          ? new Date(f.lastProducedAt.getTime() + FACTORY.intervalMs).toISOString()
          : null,
        ...(mine
          ? { ownerCash: f.owner?.money ?? 0, totalProduced: f.totalProduced, revenue: f.revenue }
          : {})
      };
    });

  return {
    currentCity: me.currentCity,
    me: { money: me.money, bullets: me.bullets },
    casinos: casinoViews,
    factories: factoryViews
  };
}
