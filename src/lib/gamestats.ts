import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GameStats = {
  takenAt: string;
  players: { total: number; alive: number };
  money: { cash: number; bank: number; crewBanks: number; total: number; gold: number; previousTotal: number | null };
  crimes: { total: number; succeeded: number; failed: number; cashEarned: number };
  autoTheft: { stolen: number; failed: number; carsNow: number };
  organisedCrime: { jobs: number; earned: number };
  kills: number;
};

const HOUR = 60 * 60 * 1000;

// The statistics are worked out at most once an hour. Anyone asking in between gets
// the saved copy.
export async function getGameStats(): Promise<GameStats> {
  const latest = await prisma.statSnapshot.findFirst({ orderBy: { takenAt: "desc" } });
  if (latest && Date.now() - latest.takenAt.getTime() < HOUR) {
    return latest.data as unknown as GameStats;
  }

  const [
    total,
    alive,
    sums,
    crewSums,
    crimeGroups,
    retired,
    carsNow
  ] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { health: { gt: 0 } } }),
    prisma.player.aggregate({
      where: { health: { gt: 0 } },
      _sum: { money: true, bank: true, gold: true, theftWins: true, theftFails: true, ocsLed: true, ocEarned: true, kills: true }
    }),
    prisma.crew.aggregate({ _sum: { bank: true } }),
    prisma.crimeLog.groupBy({
      by: ["success"],
      _count: { _all: true },
      _sum: { cashChange: true }
    }),
    prisma.statRetired.findUnique({ where: { id: "retired" } }),
    prisma.car.count()
  ]);

  let crimeTotal = retired?.crimesTotal ?? 0;
  let crimeWon = retired?.crimesWon ?? 0;
  let cashEarned = retired?.crimeCash ?? 0;
  for (const g of crimeGroups) {
    crimeTotal += g._count._all;
    if (g.success) {
      crimeWon += g._count._all;
      cashEarned += Math.max(0, g._sum.cashChange ?? 0);
    }
  }

  const cash = sums._sum.money ?? 0;
  const bank = sums._sum.bank ?? 0;
  const crewBanks = crewSums._sum.bank ?? 0;

  const stats: GameStats = {
    takenAt: new Date().toISOString(),
    players: { total, alive },
    money: {
      cash,
      bank,
      crewBanks,
      total: cash + bank + crewBanks,
      gold: sums._sum.gold ?? 0,
      previousTotal: latest ? ((latest.data as unknown as GameStats).money?.total ?? null) : null
    },
    crimes: {
      total: crimeTotal,
      succeeded: crimeWon,
      failed: crimeTotal - crimeWon,
      cashEarned
    },
    autoTheft: {
      stolen: (sums._sum.theftWins ?? 0) + (retired?.theftWins ?? 0),
      failed: (sums._sum.theftFails ?? 0) + (retired?.theftFails ?? 0),
      carsNow
    },
    organisedCrime: {
      jobs: (sums._sum.ocsLed ?? 0) + (retired?.ocsLed ?? 0),
      earned: (sums._sum.ocEarned ?? 0) + (retired?.ocEarned ?? 0)
    },
    kills: (sums._sum.kills ?? 0) + (retired?.kills ?? 0)
  };

  await prisma.statSnapshot.create({ data: { data: stats as unknown as Prisma.InputJsonValue } });
  // Old snapshots are only kept for a fortnight.
  await prisma.statSnapshot.deleteMany({ where: { takenAt: { lt: new Date(Date.now() - 14 * 24 * HOUR) } } });
  return stats;
}
