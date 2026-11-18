import Link from "next/link";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import GameShell from "@/components/GameShell";

export default async function Home() {
  const userId = await getSessionUserId();

  if (!userId) {
    return (
      <main className="landing">
        <div className="landing-mark">R</div>
        <p className="eyebrow">BRITAIN · 1933</p>
        <h1>RUMRUNNERS</h1>
        <p className="intro">
          The streets are unforgiving. Make your name in the underworld.
        </p>
        <div className="landing-actions">
          <Link className="button" href="/login">
            Enter the city
          </Link>
          <Link className="button secondary" href="/register">
            Create an account
          </Link>
        </div>
        <p className="small-note">
          A persistent, multiplayer browser game.
        </p>
      </main>
    );
  }

  const [
    player,
    account,
    recentCrimes,
    crimeGroups,
    casinoGroups,
    forumTopics,
    forumPosts
  ] = await Promise.all([
    prisma.player.findUnique({
      where: { userId }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true }
    }),
    prisma.crimeLog.findMany({
      where: {
        player: { userId }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.crimeLog.groupBy({
      by: ["crimeType", "success"],
      where: { player: { userId } },
      _count: { _all: true },
      _sum: { cashChange: true }
    }),
    prisma.casinoLog.groupBy({
      by: ["game"],
      where: { player: { userId } },
      _count: { _all: true },
      _sum: { bet: true, payout: true },
      _max: { payout: true }
    }),
    prisma.forumTopic.count({
      where: { author: { userId } }
    }),
    prisma.forumPost.count({
      where: { author: { userId } }
    })
  ]);

  const crimeTotals = new Map<
    string,
    { attempts: number; successes: number; cashEarned: number }
  >();

  for (const row of crimeGroups) {
    const entry = crimeTotals.get(row.crimeType) ?? {
      attempts: 0,
      successes: 0,
      cashEarned: 0
    };

    entry.attempts += row._count._all;

    if (row.success) {
      entry.successes += row._count._all;
      entry.cashEarned += row._sum.cashChange ?? 0;
    }

    crimeTotals.set(row.crimeType, entry);
  }

  if (!player) {
    return (
      <main className="landing">
        <h1>Player record missing</h1>
        <Link href="/logout">Sign out</Link>
      </main>
    );
  }

  return (
    <GameShell
      isAdmin={account?.isAdmin ?? false}
      playerId={player.id}
      player={{
        username: player.username,
        rank: player.rank,
        rankLevel: player.rankLevel,
        money: player.money,
        bank: player.bank,
        gold: player.gold,
        bullets: player.bullets,
        health: player.health,
        protection: player.protection,
        energy: player.energy,
        maxEnergy: player.maxEnergy,
        experience: player.experience,
        lastCrimeAt: player.lastCrimeAt?.toISOString() ?? null,
        currentCity: player.currentCity
      }}
      stats={{
        crimeByType: Array.from(crimeTotals, ([crimeType, v]) => ({
          crimeType,
          ...v
        })),
        casinoByGame: casinoGroups.map((g) => ({
          game: g.game,
          plays: g._count._all,
          wagered: g._sum.bet ?? 0,
          returned: g._sum.payout ?? 0,
          biggestPayout: g._max.payout ?? 0
        })),
        forumTopics,
        forumPosts,
        joinedAt: player.createdAt.toISOString()
      }}
      recentCrimes={recentCrimes.map((c) => ({
        crimeType: c.crimeType,
        success: c.success,
        cashChange: c.cashChange,
        createdAt: c.createdAt.toISOString()
      }))}
    />
  );
}
